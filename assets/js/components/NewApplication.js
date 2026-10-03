import { apiGet, apiPostForm } from '../api/client.js?v=114';
import AppShell from './AppShell.js?v=114';
import BaseModal from './BaseModal.js?v=114';
import { authState } from '../store/auth.js?v=114';
import { UPLOAD_ACCEPT, UPLOAD_TYPES_LABEL, uploadTypeError } from '../util.js?v=114';

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
      openTracks: [],  // which permit-type sections are expanded
      openDetail: null, // which selected permit has its description expanded at the bottom
      confirming: false, // the review-before-filing dialog
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
      // leaves nothing, and the submit button says so.
      const allResident = this.selectedTypes.every((t) => t.as_resident);
      const allBusiness = this.selectedTypes.every((t) => t.as_business);
      const opts = [];
      if (allResident) opts.push({ value: '', label: 'Myself (verified Resident)' });
      if (allBusiness) {
        this.catalog.businesses.forEach((b) => opts.push({
          value: String(b.id),
          label: b.business_name + (b.trade_name ? ' (' + b.trade_name + ')' : ''),
        }));
      }
      return opts;
    },
    // Every branch question for the selected type must be answered before submitting — forced,
    // no default. See BREAKING_CHANGES.md #4.
    // Branch questions across everything chosen, de-duplicated: two permits asking the same
    // question are answered once.
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
    // Everything that has to be true before the permit can be filed. The submit button spells
    // out whichever one is still outstanding, so a disabled button is never a dead end.
    blockingReason() {
      if (!this.hasSelection) return 'Choose a permit';
      if (!this.filingOptions.length) {
        return this.selectedTypes.length > 1
          ? 'These permits cannot be filed together — they need different filers'
          : 'You cannot file this permit yet';
      }
      if (this.needsAddress && !this.form.property_address.trim()) return 'Add the property address';
      if (this.needsAddress && !this.matchedBarangay) return 'Choose the barangay from the list';
      if (this.hasFileErrors) return 'Replace the file that was rejected';
      if (this.missingDocs.length) {
        return this.missingDocs.length === 1
          ? 'Attach ' + this.missingDocs[0]
          : 'Attach ' + this.missingDocs.length + ' more documents';
      }
      if (!this.allConditionsAnswered) return 'Answer every question first';
      return '';
    },
    canSubmit() {
      return !this.blockingReason && !this.submitting;
    },
    submitLabel() {
      const n = this.selectedTypes.length;
      return n > 1 ? 'File ' + n + ' applications' : 'Submit Application';
    },
    filingLabel() {
      const chosen = this.filingOptions.find((o) => o.value === this.form.business_id);
      return chosen ? chosen.label : '—';
    },
  },
  async mounted() {
    if (this.canApply) {
      this.catalog = await apiGet('applications.php?action=permit_types');
      // Start on the barangay the applicant is registered in — the common case — while leaving it
      // free to change, because the property is not always where you live.
      const mine = this.barangays.find((b) => b.id === this.catalog.default_barangay_id);
      if (mine) this.form.barangay = mine.name;
      // Start with the first group open so the page never looks like a wall of closed bars
      const first = this.groupedTypes[0];
      if (first) this.openTracks = [first.track];
    }
  },
  watch: {
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
      this.error = '';
      if (this.openDetail && !this.selectedIds.includes(this.openDetail)) this.openDetail = null;
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
      this.openDetail = type.id;
    },
    setMultiMode(on) {
      this.multiMode = on;
      // Coming back to single mode keeps the first choice rather than clearing the form.
      if (!on && this.selectedIds.length > 1) this.selectedIds = [this.selectedIds[0]];
    },
    toggleDetail(id) {
      this.openDetail = this.openDetail === id ? null : id;
    },
    fieldKey(docName) {
      return 'doc_' + docName.replace(/[^a-zA-Z0-9]+/g, '_');
    },
    isTrackOpen(track) {
      return this.openTracks.includes(track);
    },
    // Opening one section leaves the others alone, so groups can be compared
    toggleTrack(track) {
      this.openTracks = this.isTrackOpen(track)
        ? this.openTracks.filter((t) => t !== track)
        : [...this.openTracks, track];
    },
    // What to show on a collapsed section: the permits chosen inside it.
    selectedInTrack(group) {
      return group.types.filter((t) => this.isSelected(t.id));
    },
    // Height is animated in JS: the open height isn't known up front, and a CSS-only
    // approach can't animate to `auto`. Mirrors the FAQ on the landing page.
    trackEnter(el, done) {
      this.animateHeight(el, 0, el.scrollHeight, 220, 'cubic-bezier(.2,.7,.2,1)', done);
    },
    trackLeave(el, done) {
      this.animateHeight(el, el.getBoundingClientRect().height, 0, 170, 'cubic-bezier(.4,0,1,1)', done);
    },
    animateHeight(el, from, to, duration, easing, done) {
      const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.getAnimations().forEach((a) => a.cancel());
      el.style.overflow = 'hidden';
      const ms = reduced ? 0 : duration;
      const anim = el.animate(
        [{ height: from + 'px', opacity: from ? 1 : 0 }, { height: to + 'px', opacity: to ? 1 : 0 }],
        { duration: ms, easing },
      );
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        // Cancelling releases the animation's hold on height; without it a run that never
        // reports finishing (a background tab) would pin the section at zero.
        if (anim.playState === 'running') { try { anim.cancel(); } catch (e) { /* gone */ } }
        el.style.overflow = '';
        done();
      };
      const timer = setTimeout(finish, ms + 80);
      anim.onfinish = finish;
      anim.oncancel = finish;
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
      if (!this.hasSelection) {
        this.error = 'Please choose at least one permit.';
        return;
      }
      if (this.needsAddress && !this.form.property_address.trim()) {
        this.error = 'Property address is required.';
        return;
      }
      if (this.needsAddress && !this.matchedBarangay) {
        this.error = 'Please choose the barangay from the list — it decides which barangay office reviews this.';
        return;
      }
      if (!this.allConditionsAnswered) {
        this.error = 'Please answer every question below before submitting.';
        return;
      }
      if (this.missingDocs.length) {
        this.error = 'Please attach every required document before submitting.';
        return;
      }
      this.submitting = true;
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
        // Several permits land in My Permits together; one goes straight to its own page.
        const ids = res.application_ids || [res.application_id];
        if (ids.length > 1) this.$router.push({ path: '/permits' });
        else this.$router.push('/applications/' + ids[0]);
      } catch (e) {
        this.error = e.message;
        this.confirming = false;
      } finally {
        this.submitting = false;
      }
    },
  },
  template: `
  <AppShell>
    <div :class="canApply ? '' : 'max-w-2xl'">
      <h1 class="text-2xl font-bold text-ink-700">{{ canApply ? 'Start a New Application' : 'Browse Permits' }}</h1>
      <p class="text-slate-500 text-sm mt-1 mb-6">
        {{ canApply ? "Tell us what you're applying for — we'll only ask for what's actually required." : 'Sign in and verify your account to apply.' }}
      </p>

      <div v-if="!canApply" class="flex items-start gap-3 bg-sun-50 border border-sun-200 rounded-2xl px-4 py-3 mb-6">
        <svg class="w-5 h-5 text-sun-700 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
        <p class="text-sm text-sun-700">You're browsing as a <strong>Normal User</strong>. To apply for a permit, verify your account as a Resident or Business Owner from your dashboard.</p>
      </div>

      <!-- Two columns once a permit type is chosen: what you're applying for on the left, the
           details and the submit button in a panel on the right that stays put as you scroll. -->
      <form v-if="canApply" @submit.prevent="confirming = true"
        class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">

        <!-- LEFT: permit type, project description, declarations -->
        <div class="bg-white rounded-2xl border border-brand-100 p-6 space-y-6 min-w-0">
          <!-- Single or several. Most people file one permit, so that is the default; the switch
               is there because related permits are often needed together (a fence and the barangay
               clearance that goes with it), and filing them in one go shares the paperwork. -->
          <div class="flex flex-wrap items-center justify-between gap-3 pb-1">
            <div class="min-w-0">
              <h2 class="text-sm font-bold text-ink-700">What are you applying for?</h2>
              <p class="text-xs text-slate-500 mt-0.5">
                {{ multiMode ? 'Pick as many as you need — each becomes its own application.' : 'Pick one permit.' }}
              </p>
            </div>
            <div class="shrink-0 inline-flex rounded-xl bg-slate-100 p-1" role="group" aria-label="How many permits to file">
              <button type="button" @click="setMultiMode(false)" :aria-pressed="!multiMode"
                class="px-3 py-1.5 rounded-lg text-xs font-semibold transition"
                :class="!multiMode ? 'bg-white text-ink-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'">One permit</button>
              <button type="button" @click="setMultiMode(true)" :aria-pressed="multiMode"
                class="px-3 py-1.5 rounded-lg text-xs font-semibold transition"
                :class="multiMode ? 'bg-white text-ink-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'">Several</button>
            </div>
          </div>

          <!-- One collapsible section per track. Several can be open at once, and a collapsed
               section still shows which permits are picked inside it. -->
          <div class="space-y-2.5">
            <div v-for="group in groupedTypes" :key="group.track"
              class="rounded-xl border transition-colors"
              :class="isTrackOpen(group.track) ? 'border-brand-200 bg-meadow/40' : 'border-slate-200 bg-white hover:border-brand-200'">

              <h3>
                <button type="button" @click="toggleTrack(group.track)"
                  :aria-expanded="isTrackOpen(group.track)" :aria-controls="'track-' + group.track"
                  class="w-full flex items-center justify-between gap-3 px-4 py-3 text-left rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40">
                  <span class="min-w-0">
                    <span class="block text-sm font-semibold text-ink-700">{{ group.label }}</span>
                    <!-- when collapsed, surface the choice made inside so it isn't hidden -->
                    <span v-if="!isTrackOpen(group.track) && selectedInTrack(group).length" class="block text-xs font-semibold text-brand-700 mt-0.5 truncate">
                      {{ selectedInTrack(group).map(t => t.name).join(', ') }}
                    </span>
                    <span v-else-if="!isTrackOpen(group.track)" class="block text-xs text-slate-400 mt-0.5">
                      {{ group.types.length }} permit{{ group.types.length === 1 ? '' : 's' }}
                    </span>
                  </span>
                  <svg class="w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200" :class="isTrackOpen(group.track) ? 'rotate-180' : ''"
                    viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
                </button>
              </h3>

              <transition :css="false" @enter="trackEnter" @leave="trackLeave">
                <div v-show="isTrackOpen(group.track)" :id="'track-' + group.track">
                  <div class="flex flex-wrap gap-2 px-4 pb-4 pt-1">
                    <button
                      v-for="t in group.types" :key="t.id" type="button"
                      @click="pick(t)" :aria-pressed="isSelected(t.id)"
                      class="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border transition"
                      :class="isSelected(t.id) ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-slate-300 text-slate-600 hover:border-brand-300'"
                    >
                      <svg v-if="isSelected(t.id)" class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
                      {{ t.name }}
                    </button>
                  </div>
                </div>
              </transition>
            </div>
          </div>

          <!-- What each chosen permit actually is: what it covers, the offices it passes through,
               and the papers it needs. Collapsed by default so a long selection stays readable. -->
          <div v-if="hasSelection" class="space-y-2.5">
            <h3 class="text-sm font-bold text-ink-700">
              {{ selectedTypes.length === 1 ? 'About this permit' : 'About these ' + selectedTypes.length + ' permits' }}
            </h3>
            <div v-for="t in selectedTypes" :key="'detail-' + t.id" class="rounded-xl border border-brand-100 bg-meadow/40 overflow-hidden">
              <button type="button" @click="toggleDetail(t.id)" :aria-expanded="openDetail === t.id"
                class="w-full flex items-start justify-between gap-3 px-4 py-3 text-left">
                <span class="min-w-0">
                  <span class="block text-sm font-semibold text-ink-700">{{ t.name }}</span>
                  <span class="block text-xs text-slate-500 mt-0.5">
                    {{ t.base_steps }} office{{ t.base_steps === 1 ? '' : 's' }}
                    &middot; {{ (t.required_documents || []).length }} document{{ (t.required_documents || []).length === 1 ? '' : 's' }}
                  </span>
                </span>
                <svg class="w-4 h-4 text-slate-400 shrink-0 mt-0.5 transition-transform duration-200" :class="openDetail === t.id ? 'rotate-180' : ''"
                  viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
              </button>

              <transition :css="false" @enter="trackEnter" @leave="trackLeave">
                <div v-show="openDetail === t.id">
                  <div class="px-4 pb-4 space-y-4">
                    <p class="text-sm text-slate-600 leading-relaxed">{{ t.description }}</p>

                    <div v-if="t.route && t.route.length">
                      <p class="text-xs font-bold uppercase tracking-[0.12em] text-slate-400 mb-1.5">How it moves</p>
                      <ol class="space-y-1.5">
                        <li v-for="(r, i) in t.route" :key="i" class="flex items-start gap-2.5 text-sm">
                          <span class="w-5 h-5 rounded-full bg-white ring-1 ring-brand-200 text-[11px] font-bold text-brand-700 flex items-center justify-center shrink-0 mt-0.5">{{ i + 1 }}</span>
                          <span class="min-w-0">
                            <span class="font-semibold text-slate-700">{{ r.office }}</span>
                            <span class="text-slate-500"> — {{ r.step_label }}</span>
                            <span v-if="r.conditional" class="text-xs text-slate-400"> (only if it applies to you)</span>
                          </span>
                        </li>
                      </ol>
                    </div>

                    <div v-if="t.documents && t.documents.length">
                      <p class="text-xs font-bold uppercase tracking-[0.12em] text-slate-400 mb-1.5">What to bring</p>
                      <ul class="space-y-1 text-sm">
                        <li v-for="d in t.documents" :key="d.name" class="flex items-start gap-2 text-slate-600">
                          <span class="text-brand-600 mt-0.5">&middot;</span>
                          <span>{{ d.name }} <span class="text-xs text-slate-400">— checked by {{ d.office }}</span></span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </transition>
            </div>
          </div>

          <template v-if="hasSelection">
            <div v-if="!filingOptions.length && selectedTypes.length > 1" class="rounded-xl bg-sun-50 border border-sun-200 px-4 py-3 text-sm text-sun-700">
              These permits need different filers — one is a resident-only clearance and another is filed for a business. File them separately.
            </div>
            <div v-else-if="!filingOptions.length" class="rounded-xl bg-sun-50 border border-sun-200 px-4 py-3 text-sm text-sun-700">
              <template v-if="!selectedType.resident_eligible">A {{ selectedType.name }} permit is filed for a business. Register a business from your dashboard and wait for it to be verified.</template>
              <template v-else>To file this permit as yourself you need to be a verified Resident, or file it for one of your verified businesses.</template>
            </div>

            <template v-else>
              <div v-if="selectedTypes.some(t => t.track === 'construction')">
                <label class="block text-sm font-semibold text-slate-700 mb-1">Project Description</label>
                <textarea v-model="form.project_description" rows="3" placeholder="Adding a second seating area and updating the kitchen layout…"
                  class="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"></textarea>
              </div>

              <!-- Forced branch questions: every one must be answered before submitting. An unanswered
                   or falsely-declared condition risks the permit being voided later — see spec. -->
              <div v-if="allQuestions.length" class="space-y-3 rounded-xl bg-meadow border border-brand-100 px-4 py-4">
                <p class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Before you submit</p>
                <div v-for="q in allQuestions" :key="q.condition_key">
                  <p class="text-sm font-medium text-slate-700 mb-1.5">{{ q.label }}</p>
                  <div class="flex gap-2">
                    <button type="button" @click="form.conditions[q.condition_key] = 'yes'"
                      class="px-4 py-1.5 rounded-full text-xs font-bold border transition"
                      :class="form.conditions[q.condition_key] === 'yes' ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-slate-300 text-slate-600'"
                    >Yes</button>
                    <button type="button" @click="form.conditions[q.condition_key] = 'no'"
                      class="px-4 py-1.5 rounded-full text-xs font-bold border transition"
                      :class="form.conditions[q.condition_key] === 'no' ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-slate-300 text-slate-600'"
                    >No</button>
                  </div>
                </div>
                <p class="text-xs text-slate-400">Answer honestly — an undeclared condition discovered later voids the permit.</p>
              </div>
            </template>
          </template>
        </div>

        <!-- RIGHT: sticky panel — filing details, documents and submit. Always on screen, so the
             shape of what's still to come is visible before a permit type is picked. -->
        <aside class="lg:sticky lg:top-20 space-y-4 min-w-0">

          <!-- Waiting state: nothing chosen yet, or this permit can't be filed by this account -->
          <div v-if="!hasSelection || !filingOptions.length" class="bg-white rounded-2xl border border-brand-100 p-5">
            <div class="flex items-center gap-2.5 mb-4">
              <span class="w-8 h-8 rounded-lg bg-meadow text-brand-700 flex items-center justify-center shrink-0">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
              </span>
              <h2 class="text-sm font-semibold text-slate-700">Your application</h2>
            </div>

            <ol class="space-y-3">
              <li v-for="(s, i) in ['Choose one or more permits', 'Confirm who you are filing as', 'Attach the required documents', 'Answer the declarations']" :key="s"
                class="flex items-start gap-2.5">
                <span class="w-5 h-5 rounded-full bg-slate-100 text-slate-400 text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">{{ i + 1 }}</span>
                <span class="text-sm text-slate-500 leading-snug">{{ s }}</span>
              </li>
            </ol>

            <p v-if="!hasSelection" class="text-xs text-slate-400 mt-4 pt-4 border-t border-slate-100">
              Pick a permit on the left and the rest of the form appears here.
            </p>
            <p v-else class="text-xs text-sun-700 bg-sun-50 border border-sun-200 rounded-lg px-3 py-2 mt-4">
              This permit can't be filed from your account yet — see the note on the left.
            </p>

            <button type="button" disabled
              class="w-full mt-4 py-2.5 rounded-md bg-slate-200 text-slate-400 font-semibold cursor-not-allowed">
              Submit Application
            </button>
          </div>

          <div v-else class="bg-white rounded-2xl border border-brand-100 p-5 space-y-4">
            <div>
              <label class="block text-sm font-semibold text-slate-700 mb-1" for="filing-as">Filing as</label>
              <select id="filing-as" v-model="form.business_id"
                class="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none">
                <option v-for="o in filingOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
              </select>
            </div>

            <div v-if="needsAddress">
              <label class="block text-sm font-semibold text-slate-700 mb-1" for="prop-address">Property Address</label>
              <input id="prop-address" v-model="form.property_address" type="text" placeholder="123 Aguinaldo Hwy"
                class="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none" />

              <!-- Typed against the barangays table, not free text: this is what sends the permit to
                   a barangay secretariat, and it is the property's barangay, not the applicant's. -->
              <label class="block text-sm font-semibold text-slate-700 mb-1 mt-3" for="prop-brgy">Barangay</label>
              <input id="prop-brgy" v-model="form.barangay" list="prop-brgy-list" type="text"
                placeholder="Start typing to search…" autocomplete="off"
                class="w-full rounded-md border bg-white px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                :class="form.barangay.trim() && !matchedBarangay ? 'border-red-300' : 'border-slate-300'" />
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

            <div v-if="requiredDocs.length">
              <div class="flex items-baseline justify-between mb-2">
                <label class="block text-sm font-semibold text-slate-700">Required Documents</label>
                <span class="text-xs font-semibold" :class="missingDocs.length ? 'text-slate-400' : 'text-emerald-600'">
                  {{ requiredDocs.length - missingDocs.length }}/{{ requiredDocs.length }}
                </span>
              </div>

              <div class="space-y-2">
                <div v-for="doc in requiredDocs" :key="doc">
                  <label
                    class="flex items-center gap-3 rounded-lg border-2 border-dashed px-3.5 py-3 cursor-pointer transition"
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
                        {{ files[fieldKey(doc)] ? formatSize(files[fieldKey(doc)].size) + ' · tap to replace' : 'Tap to upload · max ' + maxUploadMb + ' MB' }}
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
              <p class="text-xs text-slate-400 mt-2">Every document is required to submit. {{ uploadTypesLabel }} — up to {{ maxUploadMb }} MB each.</p>
            </div>

            <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

            <div>
              <button type="submit" :disabled="!canSubmit"
                class="w-full py-2.5 rounded-md bg-brand-600 text-white font-semibold hover:bg-brand-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition shadow-sm">
                {{ submitting ? 'Submitting…' : submitLabel }}
              </button>
              <p v-if="blockingReason && !submitting" class="text-xs text-slate-500 text-center mt-2">{{ blockingReason }}</p>
            </div>
          </div>
        </aside>
      </form>

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
