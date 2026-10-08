import { apiGet, apiPostForm } from '../api/client.js?v=118';
import AppShell from './AppShell.js?v=118';
import BaseModal from './BaseModal.js?v=118';
import { authState } from '../store/auth.js?v=118';
import { UPLOAD_ACCEPT, UPLOAD_TYPES_LABEL, uploadTypeError } from '../util.js?v=118';

// Mirrors MAX_UPLOAD_BYTES in api/applications.php — the server rejects anything larger, so
// these two have to move together.
const MAX_UPLOAD_MB = 5;
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

const TRACK_LABELS = {
  construction: 'Construction & Property',
  business: 'Business & Commercial',
  personal: 'Personal / Barangay Documents',
  barangay_standalone: 'Barangay Clearances (standalone)',
};

// Filing is a guided flow, one short screen at a time. It used to be one long page, and people
// scrolled past the questions at the bottom without seeing them, then could not work out why
// Submit stayed grey. Here the questions are a step of their own and cannot be skipped, and they
// come before the overview because their answers decide which offices the permit goes through.
const STEPS = [
  { key: 'choose', label: 'Choose permit', title: 'What are you applying for?', hint: 'Pick a permit. Need several together? Switch to “Several”.' },
  { key: 'questions', label: 'Quick questions', title: 'A few quick questions', hint: 'Your answers decide which offices review your permit.' },
  { key: 'glance', label: 'At a glance', title: "Here's how it will go", hint: 'The offices it passes through, and what to prepare.' },
  { key: 'details', label: 'Details & submit', title: 'Almost done', hint: "Who's filing, where, and the documents." },
];

export default {
  name: 'NewApplication',
  components: { AppShell, BaseModal },
  data() {
    return {
      // Which permits are being filed. One each in single mode, any number in multiple mode;
      // either way every selected permit becomes its own application.
      selectedIds: [],
      multiMode: false,
      form: {
        property_address: '',
        barangay: '',   // typed name, matched against the barangays table
        business_id: '',
        project_description: '',
        conditions: {}, // condition_key -> 'yes' | 'no', forced before submit
      },
      files: {},      // fieldKey -> File
      fileErrors: {}, // fieldKey -> message, when the chosen file was rejected
      error: '',
      submitting: false,
      authState,
      catalog: null, // { permit_types, businesses }
      maxUploadMb: MAX_UPLOAD_MB,
      uploadAccept: UPLOAD_ACCEPT,
      uploadTypesLabel: UPLOAD_TYPES_LABEL,
      confirming: false, // the review-before-filing dialog
      steps: STEPS,
      step: 'choose',
      query: '',
      trackFilter: '',  // '' = every category
      qIndex: 0,        // the question on screen; allQuestions.length = the "all answered" summary
      expanded: [],     // permits whose description is opened on the overview
      flashing: '',     // a field just jumped to from "Still needed", ringed for a moment
      filed: false,     // the send landed: the plane becomes a tick before the page changes
      filingLine: 0,    // which line of the filing overlay is showing
      catLeft: false,   // categories run past the left edge
      catRight: false,  // …and past the right
    };
  },
  computed: {
    canApply() {
      return !!(this.authState.user && this.authState.user.can_apply);
    },
    groupedTypes() {
      if (!this.catalog) return [];
      const byTrack = {};
      for (const t of this.catalog.permit_types) {
        (byTrack[t.track] = byTrack[t.track] || []).push(t);
      }
      return Object.keys(byTrack).map((track) => ({
        track,
        label: TRACK_LABELS[track] || track,
        types: byTrack[track],
      }));
    },
    // The catalogue narrowed by the search box and the category chips, empty groups dropped
    visibleGroups() {
      const q = this.query.trim().toLowerCase();
      return this.groupedTypes
        .filter((g) => !this.trackFilter || g.track === this.trackFilter)
        .map((g) => ({
          ...g,
          types: q ? g.types.filter((t) => (t.name + ' ' + (t.description || '')).toLowerCase().includes(q)) : g.types,
        }))
        .filter((g) => g.types.length);
    },
    // The permits picked, in catalogue order so the list does not jump around as they are chosen.
    selectedTypes() {
      if (!this.catalog) return [];
      return this.catalog.permit_types.filter((t) => this.selectedIds.includes(t.id));
    },
    // Kept for the parts of the form that only make sense for one permit at a time.
    selectedType() {
      return this.selectedTypes.length === 1 ? this.selectedTypes[0] : null;
    },
    hasSelection() {
      return this.selectedTypes.length > 0;
    },
    barangays() {
      return (this.catalog && this.catalog.barangays) || [];
    },
    // The typed name matched against the table. Null until it is one of the 75 — the permit is
    // routed by this, so a near-miss has to fail rather than guess.
    matchedBarangay() {
      const typed = this.form.barangay.trim().toLowerCase();
      if (!typed) return null;
      return this.barangays.find((b) => b.name.toLowerCase() === typed) || null;
    },
    // Who this permit can be filed as: '' = the user as a Resident, or a business id
    filingOptions() {
      if (!this.hasSelection) return [];
      // Everything in one submission shares the filing details, so an option only stands if it
      // works for every permit chosen. Mixing a resident-only clearance with a business permit
      // leaves nothing, and the first step says so.
      const allResident = this.selectedTypes.every((t) => t.as_resident);
      const allBusiness = this.selectedTypes.every((t) => t.as_business);
      const opts = [];
      if (allResident) opts.push({ value: '', label: 'Myself', sub: 'Verified Resident' });
      if (allBusiness) {
        this.catalog.businesses.forEach((b) => opts.push({
          value: String(b.id),
          label: b.business_name,
          sub: b.trade_name ? 'Trading as ' + b.trade_name : 'Verified business',
        }));
      }
      return opts;
    },
    // Branch questions across everything chosen, de-duplicated: two permits asking the same
    // question are answered once. Every one is forced, no default — see BREAKING_CHANGES.md #4.
    allQuestions() {
      const seen = new Set();
      const out = [];
      this.selectedTypes.forEach((t) => (t.questions || []).forEach((q) => {
        if (!seen.has(q.condition_key)) { seen.add(q.condition_key); out.push(q); }
      }));
      return out;
    },
    allConditionsAnswered() {
      return this.allQuestions.every((q) => this.form.conditions[q.condition_key] !== undefined);
    },
    answeredCount() {
      return this.allQuestions.filter((q) => this.form.conditions[q.condition_key] !== undefined).length;
    },
    currentQuestion() {
      return this.allQuestions[this.qIndex] || null;
    },
    // The same paper required by two permits is uploaded once and attached to both.
    requiredDocs() {
      const seen = new Set();
      const out = [];
      this.selectedTypes.forEach((t) => (t.required_documents || []).forEach((d) => {
        if (!seen.has(d)) { seen.add(d); out.push(d); }
      }));
      return out;
    },
    // Which of the chosen permits each document is for, so a shared one can say so.
    docUsedBy() {
      const map = {};
      this.selectedTypes.forEach((t) => (t.required_documents || []).forEach((d) => {
        (map[d] = map[d] || []).push(t.name);
      }));
      return map;
    },
    missingDocs() {
      return this.requiredDocs.filter((d) => !this.files[this.fieldKey(d)]);
    },
    hasFileErrors() {
      return Object.values(this.fileErrors).some(Boolean);
    },
    needsAddress() {
      return this.selectedTypes.some((t) => t.track === 'construction' || t.track === 'business');
    },
    // Why the first step can't be left yet, if it can't
    chooseBlock() {
      if (!this.hasSelection) return 'Choose a permit to continue';
      if (!this.filingOptions.length) {
        if (this.selectedTypes.length > 1) return 'These permits need different filers — file them separately';
        return this.selectedType.resident_eligible
          ? 'You need to be a verified Resident, or file it for a verified business'
          : 'This permit is filed for a business — register one from your dashboard first';
      }
      return '';
    },
    // Everything the last step still needs, each one a link to the field itself
    detailIssues() {
      const out = [];
      if (this.needsAddress && !this.form.property_address.trim()) out.push({ label: 'Property address', target: 'prop-address' });
      if (this.needsAddress && !this.matchedBarangay) out.push({ label: 'Barangay (pick from the list)', target: 'prop-brgy' });
      this.requiredDocs.forEach((d) => {
        const k = this.fieldKey(d);
        if (this.fileErrors[k]) out.push({ label: 'Replace ' + d, target: 'doc-' + k });
        else if (!this.files[k]) out.push({ label: d, target: 'doc-' + k });
      });
      return out;
    },
    // Everything that has to be true before the permit can be filed.
    blockingReason() {
      if (this.chooseBlock) return this.chooseBlock;
      if (!this.allConditionsAnswered) return 'Answer every question first';
      if (this.needsAddress && !this.form.property_address.trim()) return 'Add the property address';
      if (this.needsAddress && !this.matchedBarangay) return 'Choose the barangay from the list';
      if (this.hasFileErrors) return 'Replace the file that was rejected';
      if (this.missingDocs.length) {
        return this.missingDocs.length === 1
          ? 'Attach ' + this.missingDocs[0]
          : 'Attach ' + this.missingDocs.length + ' more documents';
      }
      return '';
    },
    canSubmit() {
      return !this.blockingReason && !this.submitting;
    },
    submitLabel() {
      const n = this.selectedTypes.length;
      return n > 1 ? 'File ' + n + ' applications' : 'Submit application';
    },
    filingLabel() {
      const chosen = this.filingOptions.find((o) => o.value === this.form.business_id);
      return chosen ? chosen.label : '—';
    },
    // Where the first permit goes first — named while it's on its way, so the wait says something
    firstOffice() {
      const route = this.selectedTypes.length ? this.routeFor(this.selectedTypes[0]) : [];
      if (!route.length) return 'the first office';
      const office = route[0].office;
      return office === 'Your barangay' && this.matchedBarangay ? this.matchedBarangay.name : office;
    },
    filingLines() {
      return [
        this.requiredDocs.length ? 'Packing ' + this.requiredDocs.length + ' document' + (this.requiredDocs.length === 1 ? '' : 's') + '…' : 'Packing your application…',
        'Addressing it to ' + this.firstOffice + '…',
        'Off it goes!',
      ];
    },
    stepIndex() {
      return STEPS.findIndex((s) => s.key === this.step);
    },
    currentStep() {
      return STEPS[this.stepIndex];
    },
    // Can the flow move past this step yet?
    stepComplete() {
      return {
        choose: !this.chooseBlock,
        questions: !this.chooseBlock && this.allConditionsAnswered,
        glance: !this.chooseBlock && this.allConditionsAnswered,
        details: false,
      };
    },
  },
  async mounted() {
    if (this.canApply) {
      this.catalog = await apiGet('applications.php?action=permit_types');
      // Start on the barangay the applicant is registered in — the common case — while leaving it
      // free to change, because the property is not always where you live.
      const mine = this.barangays.find((b) => b.id === this.catalog.default_barangay_id);
      if (mine) this.form.barangay = mine.name;
      this.$nextTick(this.updateCatScroll);
    }
    // The row's width changes with the window, and so does which end has more to show
    this.onCatResize = () => this.updateCatScroll();
    window.addEventListener('resize', this.onCatResize);
  },
  beforeUnmount() {
    clearTimeout(this.qTimer);
    clearTimeout(this.flashTimer);
    clearInterval(this.lineTimer);
    clearTimeout(this.catTimer);
    window.removeEventListener('resize', this.onCatResize);
  },
  watch: {
    // Coming back to the first step remounts the row, so its ends are measured again
    step() {
      this.$nextTick(this.updateCatScroll);
    },
    'form.business_id'(id) {
      const b = this.catalog && this.catalog.businesses.find((x) => String(x.id) === id);
      if (b) {
        // Built from the parts that exist. Postal code is optional (and no longer collected), and
        // a template literal would happily write the word "null" into the address.
        this.form.property_address = [b.address_line, b.barangay ? 'Brgy. ' + b.barangay : '', [b.city, b.postal_code].filter(Boolean).join(' ')]
          .filter(Boolean).join(', ');
        if (b.barangay) this.form.barangay = b.barangay;
      }
    },
    selectedIds() {
      // Keep the filer if it still stands for the new selection; otherwise fall back to the first
      // option that does. Answers and files for documents no longer asked for are dropped.
      const stillValid = this.filingOptions.some((o) => o.value === this.form.business_id);
      if (!stillValid) {
        this.form.business_id = this.filingOptions.length ? this.filingOptions[0].value : '';
      }
      const keys = new Set(this.allQuestions.map((q) => q.condition_key));
      Object.keys(this.form.conditions).forEach((k) => { if (!keys.has(k)) delete this.form.conditions[k]; });
      const fields = new Set(this.requiredDocs.map((d) => this.fieldKey(d)));
      Object.keys(this.files).forEach((k) => { if (!fields.has(k)) delete this.files[k]; });
      Object.keys(this.fileErrors).forEach((k) => { if (!fields.has(k)) delete this.fileErrors[k]; });
      this.expanded = this.expanded.filter((id) => this.selectedIds.includes(id));
      this.error = '';
    },
  },
  methods: {
    isSelected(id) {
      return this.selectedIds.includes(id);
    },
    // Single mode replaces the choice; multiple mode adds to it. Clicking a chosen permit
    // always deselects, so there is a way back out of both.
    pick(type) {
      if (this.isSelected(type.id)) {
        this.selectedIds = this.selectedIds.filter((i) => i !== type.id);
        return;
      }
      this.selectedIds = this.multiMode ? [...this.selectedIds, type.id] : [type.id];
    },
    clearSelection() {
      this.selectedIds = [];
    },
    // Which way the category row can still be scrolled. The 2px slack keeps the arrow from
    // lingering on a sub-pixel remainder at either end.
    updateCatScroll() {
      const el = this.$refs.cats;
      if (!el) {
        this.catLeft = this.catRight = false;
        return;
      }
      this.catLeft = el.scrollLeft > 2;
      this.catRight = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
    },
    scrollCats(dir) {
      const el = this.$refs.cats;
      if (!el) return;
      el.scrollBy({ left: dir * Math.max(160, el.clientWidth * 0.7), behavior: 'smooth' });
      // Smooth scrolling reports itself frame by frame; this is the backstop for when those
      // frames don't come, so the arrows still settle on the right state.
      clearTimeout(this.catTimer);
      this.catTimer = setTimeout(this.updateCatScroll, 400);
    },
    setMultiMode(on) {
      this.multiMode = on;
      // Coming back to single mode keeps the first choice rather than clearing the form.
      if (!on && this.selectedIds.length > 1) this.selectedIds = [this.selectedIds[0]];
    },
    officeCount(t) {
      return t.base_steps;
    },
    // The offices this permit really passes through, given the answers so far: every fixed
    // step, plus the conditional ones whose question was answered yes.
    routeFor(t) {
      return (t.route || []).filter((r) => !r.conditional || this.form.conditions[r.condition_key] === 'yes');
    },
    // The offices a "yes" to this question adds, across every permit chosen
    addedBy(conditionKey) {
      const names = new Set();
      this.selectedTypes.forEach((t) => (t.route || []).forEach((r) => {
        if (r.condition_key === conditionKey) names.add(r.office);
      }));
      return [...names];
    },
    // ---- moving through the steps ----
    // A step can be opened once every step before it is complete
    reachable(i) {
      return STEPS.slice(0, i).every((s) => this.stepComplete[s.key]);
    },
    goTo(key) {
      const i = STEPS.findIndex((s) => s.key === key);
      if (i < 0 || !this.reachable(i)) return;
      // With nothing to ask, the questions step has nothing to show: straight past it
      if (key === 'questions' && !this.allQuestions.length) {
        this.goTo(this.stepIndex > i ? 'choose' : 'glance');
        return;
      }
      if (key === 'questions') {
        const first = this.allQuestions.findIndex((q) => this.form.conditions[q.condition_key] === undefined);
        this.qIndex = first >= 0 ? first : this.allQuestions.length;
      }
      this.step = key;
      this.$nextTick(() => {
        const el = this.$refs.wizard;
        if (el && el.getBoundingClientRect().top < 0) {
          window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 88, behavior: 'smooth' });
        }
      });
    },
    next() {
      if (!this.stepComplete[this.step]) return;
      const nextStep = STEPS[this.stepIndex + 1];
      if (nextStep) this.goTo(nextStep.key);
    },
    back() {
      const prev = STEPS[this.stepIndex - 1];
      if (!prev) return;
      if (prev.key === 'questions' && !this.allQuestions.length) this.goTo('choose');
      else this.goTo(prev.key);
    },
    // An answer moves on to the next unanswered question by itself, after a beat so the choice
    // is seen landing. With none left it shows the answers for a last look.
    answer(q, value) {
      this.form.conditions[q.condition_key] = value;
      clearTimeout(this.qTimer);
      this.qTimer = setTimeout(() => {
        const after = this.allQuestions.findIndex((x, i) => i > this.qIndex && this.form.conditions[x.condition_key] === undefined);
        const any = after >= 0 ? after : this.allQuestions.findIndex((x) => this.form.conditions[x.condition_key] === undefined);
        this.qIndex = any >= 0 ? any : this.allQuestions.length;
      }, 280);
    },
    toggleExpanded(id) {
      this.expanded = this.expanded.includes(id) ? this.expanded.filter((x) => x !== id) : [...this.expanded, id];
    },
    // From the "Still needed" list straight to the field, ringed for a moment so it's found
    jumpTo(target) {
      const el = document.getElementById(target);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (el.tagName === 'INPUT') el.focus({ preventScroll: true });
      this.flashing = target;
      clearTimeout(this.flashTimer);
      this.flashTimer = setTimeout(() => { this.flashing = ''; }, 1400);
    },
    askToFile() {
      if (this.canSubmit) this.confirming = true;
    },
    // ---- documents ----
    fieldKey(docName) {
      return 'doc_' + docName.replace(/[^a-zA-Z0-9]+/g, '_');
    },
    formatSize(bytes) {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
      return (bytes / 1024 / 1024).toFixed(1) + ' MB';
    },
    onFile(docName, event) {
      const key = this.fieldKey(docName);
      const file = event.target.files[0] || null;
      this.fileErrors[key] = '';
      if (!file) {
        this.files[key] = null;
        return;
      }
      const typeError = uploadTypeError(file);
      if (typeError) {
        this.files[key] = null;
        this.fileErrors[key] = typeError;
        event.target.value = '';
        return;
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        // Keep the name and size on screen so it's clear which file was refused and by how much
        this.files[key] = null;
        this.fileErrors[key] = file.name + ' is ' + this.formatSize(file.size) + ' — over the ' + MAX_UPLOAD_MB + ' MB limit.';
        event.target.value = '';
        return;
      }
      this.files[key] = file;
    },
    clearFile(docName) {
      const key = this.fieldKey(docName);
      this.files[key] = null;
      this.fileErrors[key] = '';
    },
    async submit() {
      this.error = '';
      if (this.blockingReason) {
        this.error = this.blockingReason + '.';
        this.confirming = false;
        return;
      }
      this.submitting = true;
      // The dialog gives way to the send itself: the plane flies for as long as this takes
      this.confirming = false;
      this.filed = false;
      this.filingLine = 0;
      clearInterval(this.lineTimer);
      this.lineTimer = setInterval(() => {
        if (this.filingLine < this.filingLines.length - 1) this.filingLine++;
      }, 900);
      // However fast the server is, the flight gets long enough to read as one
      const beat = new Promise((r) => setTimeout(r, 1700));
      try {
        const fd = new FormData();
        fd.append('permit_type_ids', JSON.stringify(this.selectedIds));
        fd.append('property_address', this.form.property_address);
        if (this.matchedBarangay) fd.append('barangay_id', this.matchedBarangay.id);
        fd.append('business_id', this.form.business_id);
        fd.append('project_description', this.form.project_description);
        const conditions = {};
        Object.entries(this.form.conditions).forEach(([k, v]) => { conditions[k] = v === 'yes'; });
        fd.append('conditions', JSON.stringify(conditions));
        Object.entries(this.files).forEach(([key, file]) => {
          if (file) fd.append(key, file);
        });
        const res = await apiPostForm('applications.php?action=create_v2', fd);
        await beat;
        clearInterval(this.lineTimer);
        // It landed: the plane becomes a tick, held just long enough to be seen
        this.filed = true;
        await new Promise((r) => setTimeout(r, 950));
        // Several permits land in My Permits together; one goes straight to its own page.
        const ids = res.application_ids || [res.application_id];
        if (ids.length > 1) this.$router.push({ path: '/permits' });
        else this.$router.push('/applications/' + ids[0]);
      } catch (e) {
        clearInterval(this.lineTimer);
        this.error = e.message;
        this.confirming = false;
        this.submitting = false;
      }
    },
  },
  template: `
  <AppShell :lift-chat="canApply">
    <div :class="canApply ? 'max-w-3xl mx-auto' : 'max-w-2xl'">
      <h1 class="text-2xl font-bold text-ink-700">{{ canApply ? 'Start a New Application' : 'Browse Permits' }}</h1>
      <p v-if="!canApply" class="text-slate-500 text-sm mt-1 mb-6">Sign in and verify your account to apply.</p>

      <div v-if="!canApply" class="flex items-start gap-3 bg-sun-50 border border-sun-200 rounded-2xl px-4 py-3 mb-6">
        <svg class="w-5 h-5 text-sun-700 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
        <p class="text-sm text-sun-700">You're browsing as a <strong>Normal User</strong>. To apply for a permit, verify your account as a Resident or Business Owner from your dashboard.</p>
      </div>

      <div v-if="canApply" ref="wizard" class="mt-5">

        <!-- ====== Progress: where you are and what's left ====== -->
        <ol class="grid grid-cols-4 gap-2" aria-label="Steps">
          <li v-for="(s, i) in steps" :key="s.key">
            <button type="button" @click="goTo(s.key)" :disabled="!reachable(i)"
              :aria-current="step === s.key ? 'step' : null"
              class="group w-full text-left disabled:cursor-not-allowed">
              <span class="block h-1.5 rounded-full transition-colors duration-300"
                :class="i < stepIndex ? 'bg-brand-600' : i === stepIndex ? 'bg-brand-300' : 'bg-slate-200'"></span>
              <span class="mt-2 flex items-center gap-1.5">
                <span class="w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0 transition-colors"
                  :class="i < stepIndex ? 'bg-brand-600 text-white' : i === stepIndex ? 'bg-ink-700 text-sun-300' : 'bg-slate-100 text-slate-400'">
                  <svg v-if="i < stepIndex" class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
                  <template v-else>{{ i + 1 }}</template>
                </span>
                <span class="hidden sm:block text-xs font-semibold truncate"
                  :class="i === stepIndex ? 'text-ink-700' : i < stepIndex ? 'text-brand-700 group-hover:underline' : 'text-slate-400'">
                  {{ s.label }}<template v-if="s.key === 'questions' && hasSelection && !allQuestions.length"> · none</template>
                </span>
              </span>
            </button>
          </li>
        </ol>

        <!-- ====== The step itself ====== -->
        <div class="mt-5 bg-white rounded-3xl border border-brand-100 shadow-[0_18px_40px_-34px_rgba(16,48,29,0.6)]">
          <div class="px-5 sm:px-7 pt-6">
            <p class="text-xs font-bold uppercase tracking-[0.14em] text-brand-600">Step {{ stepIndex + 1 }} of {{ steps.length }}</p>
            <h2 class="mt-1 text-xl sm:text-2xl font-extrabold tracking-tight text-ink-700">{{ currentStep.title }}</h2>
            <p class="mt-1 text-sm text-slate-500">{{ currentStep.hint }}</p>

            <!-- After the first step, what's being filed stays in view -->
            <div v-if="step !== 'choose' && hasSelection" class="mt-4 flex flex-wrap items-center gap-1.5">
              <span v-for="t in selectedTypes" :key="'chip-' + t.id"
                class="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 bg-brand-50 ring-1 ring-inset ring-brand-200 rounded-full px-2.5 py-1">
                <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
                {{ t.name }}
              </span>
              <button type="button" @click="goTo('choose')" class="text-xs font-semibold text-slate-500 hover:text-brand-700 underline-offset-2 hover:underline px-1">Change</button>
            </div>
          </div>

          <!-- Keyed by step, so each step mounts fresh and plays its CSS entrance (demo-in). Not a
               Vue <transition>: out-in waits on animation frames, and a tab that isn't painting
               would be left with an empty step. -->
          <div :key="step" class="pt-tab-in px-5 sm:px-7 pt-5 pb-6">

            <!-- ============ 1 · CHOOSE ============ -->
            <div v-if="step === 'choose'" class="space-y-4">
              <div class="flex flex-col sm:flex-row gap-2.5">
                <label class="flex-1 flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 focus-within:border-brand-600 focus-within:ring-4 focus-within:ring-brand-600/15 transition">
                  <svg class="w-4 h-4 text-slate-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
                  <input v-model="query" type="search" placeholder="Search permits — e.g. fence, business, clearance" aria-label="Search permits"
                    class="flex-1 min-w-0 py-2.5 text-sm outline-none bg-transparent" />
                </label>
                <div class="shrink-0 inline-flex rounded-xl bg-slate-100 p-1 self-start sm:self-auto" role="group" aria-label="How many permits to file">
                  <button type="button" @click="setMultiMode(false)" :aria-pressed="!multiMode"
                    class="px-3 py-1.5 rounded-lg text-xs font-semibold transition"
                    :class="!multiMode ? 'bg-white text-ink-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'">One permit</button>
                  <button type="button" @click="setMultiMode(true)" :aria-pressed="multiMode"
                    class="px-3 py-1.5 rounded-lg text-xs font-semibold transition"
                    :class="multiMode ? 'bg-white text-ink-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'">Several</button>
                </div>
              </div>

              <!-- The categories run past the edge on narrow screens. A fade and an arrow on
                   whichever side still has more make that visible instead of leaving it to be
                   discovered by accident; both disappear once that end is reached. -->
              <div class="relative">
                <div ref="cats" @scroll="updateCatScroll" class="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1 pb-0.5 scroll-smooth">
                  <button type="button" @click="trackFilter = ''"
                    class="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border transition"
                    :class="!trackFilter ? 'bg-ink-700 border-ink-700 text-white' : 'bg-white border-slate-300 text-slate-600 hover:border-brand-300'">All</button>
                  <button v-for="g in groupedTypes" :key="'f-' + g.track" type="button" @click="trackFilter = g.track"
                    class="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border transition"
                    :class="trackFilter === g.track ? 'bg-ink-700 border-ink-700 text-white' : 'bg-white border-slate-300 text-slate-600 hover:border-brand-300'">
                    {{ g.label }} <span class="opacity-60">{{ g.types.length }}</span>
                  </button>
                </div>

                <!-- more to the left -->
                <div v-show="catLeft" class="pointer-events-none absolute inset-y-0 -left-1 w-14 bg-gradient-to-r from-white via-white/85 to-transparent"></div>
                <button v-show="catLeft" type="button" @click="scrollCats(-1)" aria-label="Scroll categories left" tabindex="-1"
                  class="absolute left-0 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white text-slate-600 ring-1 ring-slate-300 shadow-sm hover:text-brand-700 hover:ring-brand-400 flex items-center justify-center transition">
                  <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>
                </button>

                <!-- more to the right -->
                <div v-show="catRight" class="pointer-events-none absolute inset-y-0 -right-1 w-14 bg-gradient-to-l from-white via-white/85 to-transparent"></div>
                <button v-show="catRight" type="button" @click="scrollCats(1)" aria-label="Scroll categories right" tabindex="-1"
                  class="absolute right-0 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white text-slate-600 ring-1 ring-slate-300 shadow-sm hover:text-brand-700 hover:ring-brand-400 flex items-center justify-center transition">
                  <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
                </button>
              </div>

              <p v-if="!catalog" class="text-sm text-slate-400 py-6 text-center">Loading permits…</p>
              <p v-else-if="!visibleGroups.length" class="text-sm text-slate-500 py-6 text-center">No permits match “{{ query }}”.</p>

              <div v-for="g in visibleGroups" :key="g.track">
                <p class="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-2">{{ g.label }}</p>
                <div class="grid sm:grid-cols-2 gap-2.5">
                  <button v-for="t in g.types" :key="t.id" type="button" @click="pick(t)" :aria-pressed="isSelected(t.id)"
                    class="relative text-left rounded-2xl border p-3.5 pr-10 transition"
                    :class="isSelected(t.id) ? 'border-brand-600 bg-brand-50 ring-1 ring-brand-600' : 'border-slate-200 bg-white hover:border-brand-300 hover:bg-meadow/40'">
                    <span class="absolute top-3.5 right-3.5 w-5 h-5 rounded-full flex items-center justify-center transition"
                      :class="isSelected(t.id) ? 'bg-brand-600 text-white' : 'ring-1 ring-slate-300'">
                      <svg v-if="isSelected(t.id)" class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
                    </span>
                    <span class="block text-sm font-semibold text-ink-700">{{ t.name }}</span>
                    <span v-if="t.description" class="block text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">{{ t.description }}</span>
                    <span class="mt-2 flex flex-wrap gap-1.5 text-[11px] font-semibold">
                      <span class="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{{ officeCount(t) }} office{{ officeCount(t) === 1 ? '' : 's' }}</span>
                      <span class="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{{ (t.required_documents || []).length }} document{{ (t.required_documents || []).length === 1 ? '' : 's' }}</span>
                      <span v-if="(t.questions || []).length" class="px-2 py-0.5 rounded-full bg-sun-100 text-sun-700">{{ t.questions.length }} question{{ t.questions.length === 1 ? '' : 's' }}</span>
                    </span>
                  </button>
                </div>
              </div>

              <div v-if="hasSelection && chooseBlock" class="flex items-start gap-2.5 rounded-xl bg-sun-50 border border-sun-200 px-4 py-3 text-sm text-sun-700">
                <svg class="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
                {{ chooseBlock }}.
              </div>
            </div>

            <!-- ============ 2 · QUESTIONS ============ -->
            <div v-else-if="step === 'questions'">
              <!-- one segment per question; any of them can be jumped back to -->
              <div class="flex items-center gap-1.5" aria-label="Question progress">
                <button v-for="(q, i) in allQuestions" :key="'seg-' + q.condition_key" type="button" @click="qIndex = i"
                  :aria-label="'Question ' + (i + 1)"
                  class="flex-1 h-2 rounded-full transition-colors duration-300"
                  :class="i === qIndex ? 'bg-ink-700' : form.conditions[q.condition_key] !== undefined ? 'bg-brand-500' : 'bg-slate-200'"></button>
              </div>

              <!-- One question at a time, as a big Yes / No -->
              <div v-if="currentQuestion" :key="'q-' + qIndex" class="demo-in mt-5">
                <p class="text-xs font-semibold text-slate-400">Question {{ qIndex + 1 }} of {{ allQuestions.length }}</p>
                <p class="mt-1.5 text-lg sm:text-xl font-bold text-ink-700 leading-snug">{{ currentQuestion.label }}</p>

                <div class="mt-5 grid grid-cols-2 gap-3">
                  <button type="button" @click="answer(currentQuestion, 'yes')"
                    class="rounded-2xl border-2 px-4 py-4 text-left transition active:scale-[0.98]"
                    :class="form.conditions[currentQuestion.condition_key] === 'yes' ? 'border-brand-600 bg-brand-50' : 'border-slate-200 hover:border-brand-300 hover:bg-meadow/40'">
                    <span class="flex items-center gap-2.5">
                      <span class="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors"
                        :class="form.conditions[currentQuestion.condition_key] === 'yes' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500'">
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
                      </span>
                      <span class="text-base font-bold text-ink-700">Yes</span>
                    </span>
                    <span v-if="addedBy(currentQuestion.condition_key).length" class="block mt-2 text-xs text-slate-500 leading-snug">
                      Adds a review by <span class="font-semibold text-slate-600">{{ addedBy(currentQuestion.condition_key).join(', ') }}</span>
                    </span>
                  </button>
                  <button type="button" @click="answer(currentQuestion, 'no')"
                    class="rounded-2xl border-2 px-4 py-4 text-left transition active:scale-[0.98]"
                    :class="form.conditions[currentQuestion.condition_key] === 'no' ? 'border-brand-600 bg-brand-50' : 'border-slate-200 hover:border-brand-300 hover:bg-meadow/40'">
                    <span class="flex items-center gap-2.5">
                      <span class="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors"
                        :class="form.conditions[currentQuestion.condition_key] === 'no' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500'">
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
                      </span>
                      <span class="text-base font-bold text-ink-700">No</span>
                    </span>
                    <span class="block mt-2 text-xs text-slate-500 leading-snug">Nothing extra to review</span>
                  </button>
                </div>

                <div class="mt-4 flex items-center justify-between text-xs">
                  <button type="button" @click="qIndex = Math.max(0, qIndex - 1)" :disabled="qIndex === 0"
                    class="font-semibold text-slate-500 hover:text-ink-700 disabled:invisible">← Previous question</button>
                  <button v-if="form.conditions[currentQuestion.condition_key] !== undefined" type="button" @click="qIndex = qIndex + 1"
                    class="font-semibold text-brand-700 hover:underline">Next →</button>
                </div>
              </div>

              <!-- Every one answered: a last look before moving on -->
              <div v-else key="q-done" class="demo-in mt-5">
                <div class="flex items-center gap-2.5 rounded-xl bg-brand-50 border border-brand-200 px-4 py-3">
                  <span class="w-7 h-7 rounded-full bg-brand-600 text-white flex items-center justify-center shrink-0">
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
                  </span>
                  <p class="text-sm font-semibold text-brand-700">All {{ allQuestions.length }} answered — check them, then continue.</p>
                </div>
                <ul class="mt-3 divide-y divide-slate-100">
                  <li v-for="(q, i) in allQuestions" :key="'ans-' + q.condition_key" class="flex items-center gap-3 py-2.5">
                    <span class="min-w-0 flex-1 text-sm text-slate-700">{{ q.label }}</span>
                    <span class="shrink-0 text-xs font-bold px-2.5 py-1 rounded-full"
                      :class="form.conditions[q.condition_key] === 'yes' ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-600'">
                      {{ form.conditions[q.condition_key] === 'yes' ? 'Yes' : 'No' }}
                    </span>
                    <button type="button" @click="qIndex = i" class="shrink-0 text-xs font-semibold text-slate-500 hover:text-brand-700">Change</button>
                  </li>
                </ul>
              </div>

              <p class="mt-5 flex items-start gap-2 text-xs text-slate-400">
                <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/></svg>
                Answer honestly — an undeclared condition discovered later voids the permit.
              </p>
            </div>

            <!-- ============ 3 · AT A GLANCE ============ -->
            <div v-else-if="step === 'glance'" class="space-y-4">
              <article v-for="t in selectedTypes" :key="'g-' + t.id" class="rounded-2xl border border-brand-100 bg-meadow/40 p-4 sm:p-5">
                <div class="flex items-start gap-3">
                  <span class="w-10 h-10 rounded-xl bg-ink-700 text-sun-300 flex items-center justify-center shrink-0">
                    <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
                  </span>
                  <div class="min-w-0 flex-1">
                    <h3 class="text-base font-bold text-ink-700">{{ t.name }}</h3>
                    <div class="mt-1 flex flex-wrap gap-1.5 text-[11px] font-semibold">
                      <span class="px-2 py-0.5 rounded-full bg-white ring-1 ring-brand-100 text-brand-700">{{ routeFor(t).length }} office{{ routeFor(t).length === 1 ? '' : 's' }}</span>
                      <span class="px-2 py-0.5 rounded-full bg-white ring-1 ring-brand-100 text-brand-700">{{ (t.documents || []).length }} document{{ (t.documents || []).length === 1 ? '' : 's' }}</span>
                    </div>
                  </div>
                </div>

                <p v-if="t.description" class="mt-3 text-sm text-slate-600 leading-relaxed" :class="expanded.includes(t.id) ? '' : 'line-clamp-2'">{{ t.description }}</p>
                <button v-if="t.description && t.description.length > 140" type="button" @click="toggleExpanded(t.id)"
                  class="mt-1 text-xs font-semibold text-brand-700 hover:underline">{{ expanded.includes(t.id) ? 'Show less' : 'Read more' }}</button>

                <div class="mt-4 grid sm:grid-cols-2 gap-4">
                  <!-- The route your answers produce, office by office -->
                  <div>
                    <p class="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-2">How it moves</p>
                    <ol>
                      <li v-for="(r, i) in routeFor(t)" :key="i" class="relative flex gap-3" :class="i < routeFor(t).length - 1 ? 'pb-3' : ''">
                        <span v-if="i < routeFor(t).length - 1" class="absolute left-[11px] top-6 bottom-0 w-0.5 bg-brand-200 rounded-full"></span>
                        <span class="relative w-6 h-6 rounded-full bg-white ring-2 ring-brand-500 text-[11px] font-bold text-brand-700 flex items-center justify-center shrink-0">{{ i + 1 }}</span>
                        <span class="min-w-0 pt-0.5">
                          <span class="block text-sm font-semibold text-ink-700 leading-tight">{{ r.office }}</span>
                          <span class="block text-xs text-slate-500 mt-0.5">{{ r.step_label }}</span>
                          <span v-if="r.conditional" class="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-sun-100 text-sun-700">Because you answered Yes</span>
                        </span>
                      </li>
                    </ol>
                  </div>
                  <!-- What to have ready -->
                  <div v-if="t.documents && t.documents.length">
                    <p class="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-2">What to prepare</p>
                    <ul class="space-y-1.5">
                      <li v-for="d in t.documents" :key="d.name" class="flex items-start gap-2.5 rounded-xl bg-white ring-1 ring-brand-100 px-3 py-2">
                        <svg class="w-4 h-4 text-brand-600 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
                        <span class="min-w-0">
                          <span class="block text-sm text-slate-700 leading-tight">{{ d.name }}</span>
                          <span class="block text-[11px] text-slate-400 mt-0.5">Checked by {{ d.office }}</span>
                        </span>
                      </li>
                    </ul>
                  </div>
                </div>
              </article>
            </div>

            <!-- ============ 4 · DETAILS & SUBMIT ============ -->
            <div v-else class="space-y-6">
              <!-- Filing as -->
              <section>
                <p class="text-sm font-bold text-ink-700 mb-2">Filing as</p>
                <div class="grid sm:grid-cols-2 gap-2.5">
                  <label v-for="o in filingOptions" :key="'f-' + o.value"
                    class="flex items-center gap-3 rounded-2xl border p-3.5 cursor-pointer transition"
                    :class="form.business_id === o.value ? 'border-brand-600 bg-brand-50 ring-1 ring-brand-600' : 'border-slate-200 hover:border-brand-300'">
                    <input type="radio" class="sr-only" name="filing-as" :value="o.value" v-model="form.business_id" />
                    <span class="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                      :class="form.business_id === o.value ? 'bg-brand-600' : 'ring-1 ring-slate-300'">
                      <span v-if="form.business_id === o.value" class="w-2 h-2 rounded-full bg-white"></span>
                    </span>
                    <span class="min-w-0">
                      <span class="block text-sm font-semibold text-ink-700 truncate">{{ o.label }}</span>
                      <span class="block text-xs text-slate-500 truncate">{{ o.sub }}</span>
                    </span>
                  </label>
                </div>
              </section>

              <!-- Where -->
              <section v-if="needsAddress" class="space-y-3">
                <p class="text-sm font-bold text-ink-700">Where is it?</p>
                <div>
                  <label class="block text-xs font-semibold text-slate-600 mb-1" for="prop-address">Property address</label>
                  <input id="prop-address" v-model="form.property_address" type="text" placeholder="123 Aguinaldo Hwy"
                    class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:ring-4 focus:ring-brand-600/15 focus:border-brand-600 outline-none transition"
                    :class="flashing === 'prop-address' ? 'ring-4 ring-sun-300' : ''" />
                </div>
                <!-- Typed against the barangays table, not free text: this is what sends the permit to
                     a barangay secretariat, and it is the property's barangay, not the applicant's. -->
                <div>
                  <label class="block text-xs font-semibold text-slate-600 mb-1" for="prop-brgy">Barangay</label>
                  <input id="prop-brgy" v-model="form.barangay" list="prop-brgy-list" type="text"
                    placeholder="Start typing to search…" autocomplete="off"
                    class="w-full rounded-xl border bg-white px-3 py-2.5 text-sm focus:ring-4 focus:ring-brand-600/15 focus:border-brand-600 outline-none transition"
                    :class="[form.barangay.trim() && !matchedBarangay ? 'border-red-300' : 'border-slate-300', flashing === 'prop-brgy' ? 'ring-4 ring-sun-300' : '']" />
                  <datalist id="prop-brgy-list">
                    <option v-for="b in barangays" :key="b.id" :value="b.name" />
                  </datalist>
                  <p v-if="form.barangay.trim() && !matchedBarangay" class="text-xs text-red-600 mt-1">
                    Not one of the {{ barangays.length }} barangays of Dasmariñas — pick one from the list.
                  </p>
                  <p v-else-if="matchedBarangay" class="text-xs text-slate-500 mt-1">
                    Reviewed first by the {{ matchedBarangay.name }} barangay secretariat.
                  </p>
                </div>
              </section>

              <section v-if="selectedTypes.some(t => t.track === 'construction')">
                <label class="block text-sm font-bold text-ink-700 mb-1" for="proj-desc">Project description <span class="font-normal text-slate-400 text-xs">(optional)</span></label>
                <textarea id="proj-desc" v-model="form.project_description" rows="3" placeholder="Adding a second seating area and updating the kitchen layout…"
                  class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:ring-4 focus:ring-brand-600/15 focus:border-brand-600 outline-none transition"></textarea>
              </section>

              <!-- Documents -->
              <section v-if="requiredDocs.length">
                <div class="flex items-baseline justify-between mb-2">
                  <p class="text-sm font-bold text-ink-700">Documents</p>
                  <span class="text-xs font-bold px-2 py-0.5 rounded-full" :class="missingDocs.length ? 'bg-slate-100 text-slate-500' : 'bg-brand-100 text-brand-700'">
                    {{ requiredDocs.length - missingDocs.length }} of {{ requiredDocs.length }} attached
                  </span>
                </div>
                <div class="space-y-2">
                  <div v-for="doc in requiredDocs" :key="doc" :id="'doc-' + fieldKey(doc)" class="rounded-xl transition"
                    :class="flashing === 'doc-' + fieldKey(doc) ? 'ring-4 ring-sun-300' : ''">
                    <label
                      class="flex items-center gap-3 rounded-xl border-2 border-dashed px-3.5 py-3 cursor-pointer transition"
                      :class="fileErrors[fieldKey(doc)] ? 'border-red-300 bg-red-50'
                        : files[fieldKey(doc)] ? 'border-emerald-300 bg-emerald-50'
                        : 'border-slate-300 hover:border-brand-300 hover:bg-slate-50'">
                      <svg v-if="files[fieldKey(doc)]" class="w-5 h-5 text-emerald-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                      <svg v-else-if="fileErrors[fieldKey(doc)]" class="w-5 h-5 text-red-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
                      <svg v-else class="w-5 h-5 text-slate-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/></svg>

                      <span class="min-w-0 flex-1">
                        <span class="block text-sm font-semibold truncate"
                          :class="fileErrors[fieldKey(doc)] ? 'text-red-700' : files[fieldKey(doc)] ? 'text-emerald-700' : 'text-slate-600'">
                          {{ files[fieldKey(doc)] ? files[fieldKey(doc)].name : doc }}
                        </span>
                        <span class="block text-xs mt-0.5"
                          :class="fileErrors[fieldKey(doc)] ? 'text-red-600' : files[fieldKey(doc)] ? 'text-emerald-600' : 'text-slate-400'">
                          {{ files[fieldKey(doc)] ? formatSize(files[fieldKey(doc)].size) + ' · tap to replace'
                            : 'Tap to upload · max ' + maxUploadMb + ' MB' + ((docUsedBy[doc] || []).length > 1 ? ' · used for ' + docUsedBy[doc].length + ' permits' : '') }}
                        </span>
                      </span>

                      <button v-if="files[fieldKey(doc)]" type="button" @click.prevent.stop="clearFile(doc)"
                        class="shrink-0 p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-100 transition" :aria-label="'Remove ' + doc">
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                      </button>
                      <input type="file" class="hidden" :accept="uploadAccept" @change="onFile(doc, $event)" />
                    </label>
                    <p v-if="fileErrors[fieldKey(doc)]" class="text-xs text-red-600 mt-1 px-1">{{ fileErrors[fieldKey(doc)] }}</p>
                  </div>
                </div>
                <p class="text-xs text-slate-400 mt-2">{{ uploadTypesLabel }} — up to {{ maxUploadMb }} MB each.</p>
              </section>

              <!-- What's left, each one a link straight to it -->
              <section v-if="detailIssues.length" class="rounded-2xl bg-sun-50 border border-sun-200 px-4 py-3.5">
                <p class="text-sm font-bold text-sun-700">Still needed before you can submit</p>
                <ul class="mt-2 flex flex-wrap gap-1.5">
                  <li v-for="it in detailIssues" :key="it.target">
                    <button type="button" @click="jumpTo(it.target)"
                      class="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-700 bg-white ring-1 ring-sun-200 hover:ring-sun-400 rounded-full px-3 py-1.5 transition">
                      <span class="w-1.5 h-1.5 rounded-full bg-sun-500"></span>
                      {{ it.label }}
                    </button>
                  </li>
                </ul>
              </section>
              <div v-else class="flex items-center gap-2.5 rounded-2xl bg-brand-50 border border-brand-200 px-4 py-3">
                <span class="w-7 h-7 rounded-full bg-brand-600 text-white flex items-center justify-center shrink-0">
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
                </span>
                <p class="text-sm font-semibold text-brand-700">Everything's in. You're ready to submit.</p>
              </div>

              <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
            </div>

          </div>

          <!-- ====== Back / Continue, always in reach ====== -->
          <div class="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:bottom-3 z-10 mx-3 mb-3 rounded-2xl bg-white/95 backdrop-blur border border-brand-100 shadow-[0_12px_30px_-18px_rgba(16,48,29,0.55)] overflow-hidden">

            <!-- Picking several adds up, so the tally and a way to empty it ride on top of the
                 bar that's already in reach, rather than back up the page among the cards. -->
            <div v-if="step === 'choose' && multiMode && selectedIds.length"
              class="flex flex-wrap items-center justify-between gap-2 bg-brand-50 border-b border-brand-100 px-3.5 py-2">
              <p class="text-xs font-semibold text-brand-700">
                {{ selectedIds.length }} permit{{ selectedIds.length === 1 ? '' : 's' }} selected
              </p>
              <button type="button" @click="clearSelection"
                class="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-white ring-1 ring-slate-300 hover:ring-red-300 hover:text-red-600 px-2.5 py-1 rounded-full transition">
                <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
                Clear all
              </button>
            </div>

            <div class="px-3 py-2.5 flex items-center gap-3">
            <button v-if="stepIndex > 0" type="button" @click="back"
              class="shrink-0 text-sm font-semibold text-slate-600 px-3.5 py-2.5 rounded-xl hover:bg-slate-100 transition">Back</button>

            <p class="min-w-0 flex-1 text-xs truncate"
              :class="(step === 'choose' && chooseBlock) || (step === 'questions' && !allConditionsAnswered) || (step === 'details' && blockingReason) ? 'text-slate-500' : 'text-brand-700 font-semibold'">
              <!-- the tally is on the strip above, so this never repeats it -->
              <template v-if="step === 'choose'">{{ chooseBlock || (selectedTypes.length > 1 ? '' : selectedTypes[0].name) }}</template>
              <template v-else-if="step === 'questions'">{{ allConditionsAnswered ? 'All questions answered' : answeredCount + ' of ' + allQuestions.length + ' answered' }}</template>
              <template v-else-if="step === 'glance'">Next: who's filing and your documents</template>
              <template v-else>{{ blockingReason || 'Ready to file' }}</template>
            </p>

            <button v-if="step !== 'details'" type="button" @click="next" :disabled="!stepComplete[step]"
              class="shrink-0 inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 disabled:cursor-not-allowed px-5 py-2.5 rounded-xl transition shadow-[0_8px_18px_-8px_rgba(31,122,58,0.6)] disabled:shadow-none">
              Continue
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            </button>
            <button v-else type="button" @click="askToFile" :disabled="!canSubmit"
              class="shrink-0 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 disabled:cursor-not-allowed px-5 py-2.5 rounded-xl transition shadow-[0_8px_18px_-8px_rgba(31,122,58,0.6)] disabled:shadow-none">
              {{ submitting ? 'Submitting…' : submitLabel }}
            </button>
            </div>
          </div>
        </div>
      </div>

      <!-- The send itself: the application flies off to the first office, then lands as a tick -->
      <transition name="veil">
        <div v-if="submitting" class="fixed inset-0 z-[80] flex items-center justify-center p-6 bg-ink-900/55 backdrop-blur-md" role="status" aria-live="polite">
          <div class="text-center">
            <div class="relative mx-auto w-48 h-28">
              <!-- the arc it travels, dashes running along it like a route on a map -->
              <svg class="absolute inset-0 w-full h-full" viewBox="0 0 192 112" fill="none" aria-hidden="true">
                <path class="file-trail text-white/25" d="M16 86C52 86 70 58 96 44s56-18 80-18" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
              </svg>

              <div class="absolute inset-0 flex items-center justify-center">
                <!-- in flight -->
                <span v-if="!filed" class="file-plane text-sun-300" aria-hidden="true">
                  <svg class="w-12 h-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                </span>
                <!-- landed -->
                <span v-else class="file-pop w-16 h-16 rounded-full bg-brand-500 text-white flex items-center justify-center shadow-[0_12px_30px_-8px_rgba(31,122,58,0.8)]" aria-hidden="true">
                  <svg class="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                </span>
              </div>
            </div>

            <p class="mt-3 text-xl font-extrabold tracking-tight text-white">
              {{ filed ? (selectedIds.length > 1 ? 'All ' + selectedIds.length + ' filed!' : 'Filed!') : 'Sending it off…' }}
            </p>
            <p class="mt-1 text-sm text-white/70">
              {{ filed ? 'Taking you to your permit…' : filingLines[filingLine] }}
            </p>
          </div>
        </div>
      </transition>

      <!-- Filing puts this in front of City Staff, so it asks first and shows what will be sent -->
      <BaseModal v-if="confirming" :title="selectedTypes.length > 1 ? 'File these ' + selectedTypes.length + ' applications?' : 'File this application?'" eyebrow="Check before you send"
        :subtitle="selectedTypes.map(t => t.name).join(', ')" @close="confirming = false">
        <template #icon>
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
        </template>

        <dl class="space-y-2.5 text-sm">
          <div class="flex justify-between gap-4">
            <dt class="text-slate-500 shrink-0">Filing as</dt>
            <dd class="font-semibold text-ink-700 text-right">{{ filingLabel }}</dd>
          </div>
          <div v-if="needsAddress" class="flex justify-between gap-4">
            <dt class="text-slate-500 shrink-0">Address</dt>
            <dd class="font-semibold text-ink-700 text-right">{{ form.property_address }}</dd>
          </div>
          <div v-if="allQuestions.length" class="flex justify-between gap-4">
            <dt class="text-slate-500 shrink-0">Questions</dt>
            <dd class="font-semibold text-ink-700 text-right">{{ allQuestions.length }} answered</dd>
          </div>
          <div class="flex justify-between gap-4">
            <dt class="text-slate-500 shrink-0">Documents</dt>
            <dd class="font-semibold text-ink-700 text-right">{{ requiredDocs.length }} attached</dd>
          </div>
        </dl>

        <p class="text-sm text-slate-600 leading-relaxed mt-4 rounded-xl bg-meadow border border-brand-100 px-3.5 py-3">
          You can still edit or discard this from <span class="font-semibold text-ink-700">My Permits</span> until a
          reviewer picks it up — it won't affect the queue.
        </p>

        <p v-if="error" class="text-sm text-red-600 mt-3">{{ error }}</p>

        <template #footer>
          <div class="ml-auto flex items-center gap-2">
            <button type="button" @click="confirming = false" class="text-sm font-semibold text-slate-600 px-4 py-2.5 rounded-xl hover:bg-slate-200/60 transition">Go back</button>
            <button type="button" @click="submit" :disabled="submitting"
              class="text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-60 px-5 py-2.5 rounded-xl transition shadow-[0_8px_18px_-8px_rgba(31,122,58,0.6)]">
              {{ submitting ? 'Filing…' : 'Yes, file it' }}
            </button>
          </div>
        </template>
      </BaseModal>
    </div>
  </AppShell>
  `,
};
