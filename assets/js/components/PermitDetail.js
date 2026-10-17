import { apiGet, apiPost, apiPostForm, viewUrl } from '../api/client.js?v=169';
import AppShell from './AppShell.js?v=169';
import StatusStepper from './StatusStepper.js?v=169';
import { permitNumber, permitIconClass, formatDate, formatDateTime, backButtonClass, backIconClass, UPLOAD_ACCEPT, uploadTypeError, permitLabel, rejectReasonLabel, DELIVERY_STATUS_STEPS, deliveryStatusLabel, formatPeso, DELIVERY_FEE, isRenewableBaseType } from '../util.js?v=169';
import { uiState, toggleReviewerHints } from '../store/ui.js?v=169';
import Loader from './Loader.js?v=169';
import BaseModal from './BaseModal.js?v=169';
import ThreadCard from './ThreadCard.js?v=169';

export default {
  name: 'PermitDetail',
  setup: () => ({ backButtonClass, backIconClass }),
  components: { AppShell, StatusStepper, Loader, BaseModal, ThreadCard },
  data() {
    return {
      uiState,
      app: null,
      activity: [],
      loading: true,
      reuploadingId: null,
      uploadAccept: UPLOAD_ACCEPT,
      docError: '',   // why the last file was refused, shown under the documents list
      expandedHistory: {}, // document id -> bool, which revision-history lists are open
      payMethod: '',  // 'gcash' | 'maya' | 'bank_transfer', chosen before the simulated checkout
      paySaving: false,
      payError: '',
      paymentMethodOptions: [
        { value: 'gcash', label: 'GCash' },
        { value: 'maya', label: 'Maya' },
        { value: 'bank_transfer', label: 'Bank Transfer' },
      ],
      // Editing the details in place, and taking the application back out of the queue. Both are
      // only offered while nobody has started reviewing it (the API's `editable`).
      editing: false,
      editForm: { property_address: '', project_description: '' },
      saving: false,
      editError: '',
      confirmDiscard: false,
      discarding: false,
      discardError: '',
      // Pickup vs. delivery, offered once the permit is Approved and not yet chosen.
      deliveryChoice: '', // 'pickup' | 'delivery', picked before the address field shows
      deliveryAddress: '',
      deliverySaving: false,
      deliveryError: '',
      deliveryFee: DELIVERY_FEE,
      deliverySteps: DELIVERY_STATUS_STEPS,
      // Batch delivery: unified choice for all output files across all pipeline nodes.
      batchDeliveryChoice: '', // 'barangay_pickup' | 'delivery'
      batchDeliveryAddress: '', // auto-populated from applicant's registered address
      batchDeliveryLandmarks: '', // optional landmarks / additional directions
      batchDeliverySaving: false,
      batchDeliveryError: '',
    };
  },
  async mounted() {
    await this.refresh();
    this.initBatchAddress();
  },
  computed: {
    // The step the permit is sitting on right now — the one a reviewer has to act on next.
    currentStep() {
      return (this.app && this.app.pipeline || []).find((s) => s.status === 'current') || null;
    },
    // The API only sends reviewer accounts on installs that allow it, so the switch appears
    // only where there is something to show.
    canShowHints() {
      return (this.app && this.app.pipeline || []).some((s) => s.reviewer_login);
    },
    // Until a reviewer picks it up, the applicant can still change it or pull it back
    canEdit() {
      return !!(this.app && this.app.editable);
    },
    // Only the tracks that collect one; the rest store 'N/A'
    editNeedsAddress() {
      return !!(this.app && this.app.property_address && this.app.property_address !== 'N/A');
    },
    deliveryStepIndex() {
      return DELIVERY_STATUS_STEPS.findIndex((s) => s.value === (this.app && this.app.delivery_status));
    },
    // Pipeline nodes that produced output files and whose delivery has not yet been chosen.
    // These are shown together in one "Documents ready for delivery" batch section.
    batchOutputSteps() {
      return (this.app && this.app.pipeline || []).filter(
        (s) => s.has_output && s.step_label !== 'Issued directly by the barangay'
      );
    },
    // True once every output step that needs a choice already has one.
    batchDeliveryDone() {
      return this.batchOutputSteps.length > 0 && this.batchOutputSteps.every((s) => s.delivery_method);
    },
    // The first delivery method chosen across all steps (they are all set in one go).
    batchDeliveryMethod() {
      const step = this.batchOutputSteps.find((s) => s.delivery_method);
      return step ? step.delivery_method : null;
    },
  },
  methods: {
    permitLabel,
    isRenewableBaseType,
    rejectReasonLabel,
    toggleReviewerHints,
    permitNumber,
    permitIconClass,
    formatDate,
    formatDateTime,
    viewUrl,
    deliveryStatusLabel,
    formatPeso,
    toggleHistory(docId) {
      this.expandedHistory = { ...this.expandedHistory, [docId]: !this.expandedHistory[docId] };
    },
    paymentMethodLabel(v) {
      const found = this.paymentMethodOptions.find((m) => m.value === v);
      return found ? found.label : v;
    },
    async payNow(simulate) {
      this.payError = '';
      this.paySaving = true;
      try {
        const res = await apiPost('payments.php?action=checkout', {
          application_ids: [this.app.id],
          method: this.payMethod,
          simulate,
        });
        if (res.requires_redirect && res.checkout_url) {
          window.location.href = res.checkout_url;
          return;
        }
        if (!res.succeeded) {
          this.payError = res.message;
        }
        await this.refresh(true);
      } catch (e) {
        this.payError = e.message;
      } finally {
        this.paySaving = false;
      }
    },
    // `silent` skips the full-page Loader: used after an in-place action (editing, discarding,
    // re-uploading a document, choosing pickup/delivery) where the page is already showing and
    // swapping it out for the Loader's much shorter layout, then back, is what was making the
    // scroll position jump. Only the very first load needs the Loader — there's nothing to show yet.
    async refresh(silent = false) {
      if (!silent) this.loading = true;
      const id = this.$route.params.id;
      const [detailRes, activityRes] = await Promise.all([
        apiGet(`applications.php?action=detail&id=${id}`),
        apiGet(`messages.php?action=list&application_id=${id}`),
      ]);
      this.app = detailRes.application;
      this.activity = activityRes.activity;
      if (!silent) this.loading = false;
    },
    // Pipeline apps (27-type flow) carry pipeline rows; legacy apps (5-type flow) have none.
    // See BREAKING_CHANGES.md #3.
    stepClass(status) {
      return {
        approved: 'bg-brand-100 text-brand-700',
        rejected: 'bg-red-100 text-red-700',
        current: 'bg-sun-400 text-ink-700',
        pending: 'bg-slate-100 text-slate-400',
        skipped: 'bg-slate-50 text-slate-300',
      }[status] || 'bg-slate-100 text-slate-400';
    },
    startEdit() {
      this.editForm.property_address = this.app.property_address === 'N/A' ? '' : (this.app.property_address || '');
      this.editForm.project_description = this.app.project_description || '';
      this.editError = '';
      this.editing = true;
    },
    async saveEdit() {
      if (this.saving) return;
      this.editError = '';
      if (this.editNeedsAddress && !this.editForm.property_address.trim()) {
        this.editError = 'Property address is required.';
        return;
      }
      this.saving = true;
      try {
        await apiPost('applications.php?action=update', {
          id: this.app.id,
          property_address: this.editForm.property_address,
          project_description: this.editForm.project_description,
        });
        this.editing = false;
        await this.refresh(true);
      } catch (e) {
        this.editError = e.message;
      } finally {
        this.saving = false;
      }
    },
    async discard() {
      if (this.discarding) return;
      this.discardError = '';
      this.discarding = true;
      try {
        await apiPost('applications.php?action=withdraw', { id: this.app.id });
        this.confirmDiscard = false;
        await this.refresh(true);
      } catch (e) {
        this.discardError = e.message;
      } finally {
        this.discarding = false;
      }
    },
    async reupload(doc, event) {
      const file = event.target.files[0];
      if (!file) return;
      this.docError = '';
      // Caught here as well as on the server, so an obviously wrong file fails before the upload
      const typeError = uploadTypeError(file);
      if (typeError) {
        this.docError = typeError;
        event.target.value = '';
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        this.docError = file.name + ' is larger than the 5 MB limit.';
        event.target.value = '';
        return;
      }
      const fd = new FormData();
      fd.append('document_id', doc.id);
      fd.append('file', file);
      this.reuploadingId = doc.id;
      try {
        await apiPostForm('documents.php?action=reupload', fd);
        await this.refresh(true);
      } catch (e) {
        this.docError = e.message;
      } finally {
        this.reuploadingId = null;
        event.target.value = '';
      }
    },
    async chooseDelivery(method) {
      if (this.deliverySaving) return;
      this.deliveryError = '';
      if (method === 'delivery' && !this.deliveryAddress.trim()) {
        this.deliveryChoice = 'delivery';
        this.deliveryError = 'Please give an address to deliver to.';
        return;
      }
      this.deliverySaving = true;
      try {
        await apiPost('applications.php?action=set_delivery', {
          id: this.app.id,
          delivery_method: method,
          delivery_address: this.deliveryAddress,
        });
        await this.refresh(true);
      } catch (e) {
        this.deliveryError = e.message;
      } finally {
        this.deliverySaving = false;
      }
    },
    // Batch delivery: called once for ALL pipeline output steps at the same time.
    // Populates address from the applicant's registered address when the component mounts;
    // the applicant can override it before confirming.
    initBatchAddress() {
      if (!this.batchDeliveryAddress && this.app && this.app.applicant_address) {
        this.batchDeliveryAddress = this.app.applicant_address;
      }
    },
    async chooseBatchDelivery() {
      if (this.batchDeliverySaving) return;
      this.batchDeliveryError = '';
      if (!this.batchDeliveryChoice) {
        this.batchDeliveryError = 'Please choose how you want to receive your documents.';
        return;
      }
      if (this.batchDeliveryChoice === 'delivery' && !this.batchDeliveryAddress.trim()) {
        this.batchDeliveryError = 'Please provide a delivery address.';
        return;
      }
      this.batchDeliverySaving = true;
      try {
        await apiPost('applications.php?action=set_batch_delivery', {
          id: this.app.id,
          delivery_method: this.batchDeliveryChoice,
          delivery_address: this.batchDeliveryAddress,
          delivery_landmarks: this.batchDeliveryLandmarks,
        });
        await this.refresh(true);
      } catch (e) {
        this.batchDeliveryError = e.message;
      } finally {
        this.batchDeliverySaving = false;
      }
    },
  },
  template: `
  <AppShell>
    <Loader v-if="loading" kind="detail" />
    <template v-else-if="app">
      <router-link to="/dashboard" :class="backButtonClass">
        <span :class="backIconClass"><svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg></span>
        Back to Dashboard
      </router-link>

      <div class="mt-4 flex items-start justify-between flex-wrap gap-3">
        <div class="flex items-center gap-4">
          <div class="w-11 h-11 rounded-lg flex items-center justify-center shrink-0" :class="permitIconClass(app.permit_type || app.permit_type_name)">
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
          </div>
          <div>
            <h1 class="text-xl font-bold text-ink-700">{{ permitLabel(app.permit_type || app.permit_type_name) }}</h1>
            <div class="text-sm text-slate-500">{{ app.property_address }} &middot; Permit #{{ permitNumber(app) }}</div>
          </div>
        </div>
        <div class="flex items-center gap-2 h-fit">
          <!-- Only while nobody has started on it: once a reviewer has, the way to change
               anything is to message them. -->
          <template v-if="canEdit">
            <button type="button" @click="startEdit"
              class="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-700 bg-white ring-1 ring-slate-300 hover:ring-brand-400 hover:text-brand-700 px-3 py-1.5 rounded-full transition">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>
              Edit
            </button>
            <button type="button" @click="confirmDiscard = true"
              class="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-white ring-1 ring-red-200 hover:ring-red-400 hover:bg-red-50 px-3 py-1.5 rounded-full transition">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
              Discard
            </button>
          </template>
          <!-- Renewable base permit, approved, with a renewal type set up (section 2) -->
          <router-link v-if="app.status === 'Approved' && isRenewableBaseType(app.permit_type || app.permit_type_name)"
            :to="'/applications/new?renew=' + app.id"
            class="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 px-3.5 py-1.5 rounded-full transition shadow-sm">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>
            Renew Permit
          </router-link>
          <span class="text-xs font-bold px-3 py-1.5 rounded-full"
            :class="app.status === 'Approved' ? 'bg-brand-100 text-brand-700'
              : app.status === 'Rejected' || app.status === 'Withdrawn' ? 'bg-slate-200 text-slate-600'
              : 'bg-amber-100 text-amber-800'">{{ app.status }}</span>
        </div>
      </div>

      <p v-if="canEdit" class="mt-2 text-xs text-slate-400">
        You can still change or discard this until a reviewer picks it up.
      </p>

      <!-- Payment Pending (section 3): the pipeline isn't built yet — nothing to show as a route
           or a stepper until payment is confirmed. A declined simulated attempt lands here too,
           with a way to try again. -->
      <div v-if="app.status === 'Payment Pending'" class="bg-white rounded-xl border border-amber-200 p-6 mt-6">
        <h2 class="font-bold text-ink-700 mb-1">Payment needed</h2>
        <p class="text-sm text-slate-500 mb-4">{{ formatPeso(app.fee_charged) }} due to {{ app.payment && app.payment.recipient_department_name }} before this application is reviewed.</p>
        <p v-if="app.payment && app.payment.status === 'failed'" class="text-sm text-red-600 mb-3">Your last attempt didn't go through — try again below.</p>

        <!-- Checkout already succeeded — the payment-bridge office just hasn't confirmed receipt
             yet. Re-paying isn't offered here; the method picker only shows for a first attempt
             or after a declined one. -->
        <div v-if="app.payment && app.payment.status === 'pending' && app.payment.reference" class="rounded-xl bg-brand-50 border border-brand-200 px-4 py-3 text-sm text-brand-700">
          Payment received via {{ paymentMethodLabel(app.payment.method) }} (ref {{ app.payment.reference }}) — waiting on {{ app.payment.recipient_department_name }} to confirm it arrived.
        </div>
        <template v-else>
          <div v-if="!payMethod" class="grid sm:grid-cols-3 gap-2.5 mb-4">
            <button v-for="m in paymentMethodOptions" :key="m.value" type="button" @click="payMethod = m.value"
              class="rounded-xl border border-slate-200 hover:border-brand-300 px-3.5 py-3 text-sm font-semibold text-ink-700 transition">{{ m.label }}</button>
          </div>
          <template v-else>
            <p class="text-sm text-slate-600 mb-3">Paying with <span class="font-semibold">{{ paymentMethodLabel(payMethod) }}</span> — PayMongo sandbox (test mode). You will be redirected to authorise your payment.</p>
            <div class="flex flex-wrap gap-2">
              <button type="button" @click="payNow('success')" :disabled="paySaving"
                class="text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-60 px-4 py-2.5 rounded-xl transition">{{ paySaving ? 'Processing…' : 'Pay now' }}</button>
              <button type="button" @click="payMethod = ''" :disabled="paySaving" class="text-sm font-semibold text-slate-500 hover:bg-slate-100 px-4 py-2.5 rounded-xl transition">Change method</button>
            </div>
          </template>
          <p v-if="payError" class="text-sm text-red-600 mt-3">{{ payError }}</p>
        </template>
      </div>

      <!-- Pipeline apps (27-type flow): show each office in order. Legacy apps (5-type flow,
           empty app.pipeline) keep the original single-stage stepper. -->
      <div v-if="app.status !== 'Payment Pending' && app.pipeline && app.pipeline.length" class="bg-white rounded-xl border border-slate-200 p-6 mt-6">
        <div class="flex items-start justify-between gap-4 mb-4">
          <h2 class="font-bold text-ink-700">Where your application is</h2>
          <!-- Testing aid: name the account each office reviews with, so a permit can be walked
               through its pipeline by hand. Hidden entirely on installs that switch it off. -->
          <button v-if="canShowHints" type="button" role="switch" :aria-checked="uiState.reviewerHints"
            @click="toggleReviewerHints()"
            class="shrink-0 inline-flex items-center gap-2 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition"
            :class="uiState.reviewerHints ? 'bg-sun-100 text-ink-700 ring-1 ring-sun-300' : 'text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50'">
            <span class="w-7 h-4 rounded-full relative transition-colors" :class="uiState.reviewerHints ? 'bg-sun-400' : 'bg-slate-300'">
              <span class="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all" :class="uiState.reviewerHints ? 'left-3.5' : 'left-0.5'"></span>
            </span>
            Reviewer accounts
          </button>
        </div>

        <div v-if="uiState.reviewerHints && currentStep && currentStep.reviewer_login"
          class="mb-4 rounded-xl bg-sun-50 ring-1 ring-sun-300 px-4 py-3">
          <p class="text-xs font-bold uppercase tracking-[0.12em] text-sun-700">Next approval</p>
          <p class="text-sm text-ink-700 mt-1 leading-relaxed">
            Sign in as <span class="font-mono font-semibold break-all">{{ currentStep.reviewer_login }}</span>
            to approve <span class="font-semibold">{{ currentStep.step_label }}</span>
            at {{ currentStep.department_name }}.
          </p>
        </div>

        <ol class="space-y-3">
          <li v-for="step in app.pipeline" :key="step.id" class="flex items-start gap-3 text-sm">
            <span class="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold" :class="stepClass(step.status)">
              <svg v-if="step.status === 'approved'" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>
              <svg v-else-if="step.status === 'rejected'" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M18 6 6 18M6 6l12 12"/></svg>
              <template v-else>&middot;</template>
            </span>
            <div class="min-w-0">
              <div class="font-semibold text-slate-700">{{ step.department_name }}</div>
              <div class="text-xs text-slate-400">{{ step.step_label }}</div>
              <div v-if="uiState.reviewerHints && step.reviewer_login"
                class="text-[11px] font-mono text-slate-500 mt-0.5 break-all"
                :class="step.status === 'current' ? 'text-sun-700 font-semibold' : ''">
                {{ step.reviewer_login }}
              </div>
            </div>
          </li>
        </ol>
      </div>
      <div v-else-if="app.status !== 'Payment Pending'" class="bg-white rounded-xl border border-slate-200 p-6 mt-6">
        <StatusStepper :stages="app.stages" :active-index="app.stage_index" :rejected="app.status === 'Rejected'" />
      </div>

      <!-- Renewal info for approved renewable permits (section 2) -->
      <div v-if="app.status === 'Approved' && isRenewableBaseType(app.permit_type || app.permit_type_name)"
        class="bg-brand-50 border border-brand-200 rounded-xl p-4 mt-6 flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-start gap-2.5 min-w-0">
          <svg class="w-5 h-5 text-brand-700 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>
          <div>
            <p class="text-sm font-bold text-ink-700">Renewable Permit · Due every year by January 20</p>
            <p class="text-xs text-slate-600 mt-0.5">When renewing, your issued files and approvals from this permit are automatically pre-listed for your renewal application.</p>
          </div>
        </div>
        <router-link :to="'/applications/new?renew=' + app.id"
          class="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 px-4 py-2 rounded-xl transition shadow-sm shrink-0">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>
          Renew Now
        </router-link>
      </div>

      <!-- Pickup vs. delivery (whole-application, legacy/non-pipeline approved apps).
           Only shown for approved non-pipeline apps where delivery_method is not yet chosen. -->
      <div v-if="app.status === 'Approved' && !app.pipeline?.length" class="bg-white rounded-xl border border-slate-200 p-6 mt-6">
        <h2 class="font-bold text-ink-700 mb-1">Getting your permit</h2>

        <template v-if="!app.delivery_method">
          <p class="text-sm text-slate-500 mb-4">Soft copies are always downloadable above. For a hard copy — pick up at your barangay hall or have it delivered to your address — all free.</p>
          <div class="grid sm:grid-cols-2 gap-3">
            <button type="button" @click="deliveryChoice = 'barangay_pickup'"
              class="text-left rounded-xl border-2 p-4 transition"
              :class="deliveryChoice === 'barangay_pickup' ? 'border-brand-300 bg-meadow' : 'border-slate-200 hover:border-brand-300'">
              <div class="font-semibold text-slate-700">Pick up at my barangay hall</div>
              <div class="text-xs text-slate-400 mt-1">Closer than the issuing office.</div>
            </button>
            <button type="button" @click="deliveryChoice = 'delivery'"
              class="text-left rounded-xl border-2 p-4 transition"
              :class="deliveryChoice === 'delivery' ? 'border-brand-300 bg-meadow' : 'border-slate-200 hover:border-brand-300'">
              <div class="font-semibold text-slate-700">Deliver to my address</div>
              <div class="text-xs text-slate-400 mt-1">Free.</div>
            </button>
          </div>
          <div v-if="deliveryChoice === 'delivery'" class="mt-4">
            <label class="block text-xs font-semibold text-slate-600 mb-1.5" for="delivery-address">Delivery address</label>
            <textarea id="delivery-address" v-model="deliveryAddress" rows="2"
              class="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm placeholder:text-slate-400 focus:ring-4 focus:ring-brand-600/15 focus:border-brand-600 outline-none transition"
              placeholder="Where should it be delivered?"></textarea>
          </div>
          <button v-if="deliveryChoice" type="button" @click="chooseDelivery(deliveryChoice)" :disabled="deliverySaving"
            class="mt-4 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-60 px-5 py-2.5 rounded-xl transition">
            {{ deliverySaving ? 'Saving…' : deliveryChoice === 'delivery' ? 'Confirm delivery' : 'Confirm pickup' }}
          </button>
          <p v-if="deliveryError" class="text-sm text-red-600 mt-3">{{ deliveryError }}</p>
        </template>

        <template v-else>
          <p class="text-sm text-slate-500 mb-4">
            <template v-if="app.delivery_method === 'barangay_pickup'">Being prepared for pickup at <span class="font-semibold text-slate-700">your barangay hall</span>.</template>
            <template v-else>Being delivered to <span class="font-semibold text-slate-700">{{ app.delivery_address }}</span>.</template>
          </p>
          <ol class="flex flex-wrap gap-3">
            <li v-for="(step, i) in deliverySteps" :key="step.value" class="flex items-center gap-2 text-sm">
              <span class="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                :class="i <= deliveryStepIndex ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-400'">
                <svg v-if="i < deliveryStepIndex || app.delivery_status === 'delivered'" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>
                <template v-else>{{ i + 1 }}</template>
              </span>
              <span :class="i <= deliveryStepIndex ? 'font-semibold text-slate-700' : 'text-slate-400'">{{ step.label }}</span>
            </li>
          </ol>
        </template>
      </div>

      <!-- Batch delivery section: shown when there are pipeline output files ready.
           All files from approved offices are listed on the left; the applicant makes
           ONE delivery choice for everything together — matching wireframe layout. -->
      <div v-if="batchOutputSteps.length" class="bg-white rounded-2xl border border-slate-200 mt-6 overflow-hidden shadow-sm">
        <div class="px-6 py-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 class="text-base font-bold text-ink-700">Documents / Files Batch Delivery</h2>
            <p class="text-xs text-slate-500 mt-0.5">
              All approved papers from the municipality go through your <strong class="text-brand-700">Barangay</strong> first before heading to you.
            </p>
          </div>
          <span class="text-xs font-semibold px-2.5 py-1 rounded-full bg-brand-100 text-brand-700">
            {{ batchOutputSteps.length }} {{ batchOutputSteps.length === 1 ? 'Office ready' : 'Offices ready' }}
          </span>
        </div>

        <div class="grid lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">

          <!-- Left column (55-60% width): list of documents / files -->
          <div class="lg:col-span-7 p-6 bg-white flex flex-col justify-between">
            <div>
              <div class="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                <span class="text-xs font-bold uppercase tracking-wider text-slate-500">List of Documents / Files</span>
                <span class="text-xs text-slate-400">Soft copies always available</span>
              </div>

              <div class="space-y-4">
                <div v-for="step in batchOutputSteps" :key="step.id"
                  class="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 transition hover:border-slate-300">
                  <div class="flex items-center justify-between gap-2">
                    <div class="flex items-center gap-2 min-w-0">
                      <span class="w-6 h-6 rounded-full flex items-center justify-center shrink-0 bg-brand-100 text-brand-700">
                        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                      </span>
                      <div class="min-w-0">
                        <h3 class="text-sm font-bold text-slate-800 truncate">{{ step.step_label }}</h3>
                        <p class="text-[11px] text-slate-500">{{ step.department_name }}</p>
                      </div>
                    </div>
                    <span v-if="step.delivery_method && step.delivery_status"
                      class="text-[11px] font-bold px-2 py-0.5 rounded-full bg-brand-100 text-brand-700 shrink-0">
                      {{ deliveryStatusLabel(step.delivery_status) }}
                    </span>
                  </div>

                  <!-- Specific documents produced by this step -->
                  <ul v-if="step.output_documents && step.output_documents.length" class="mt-2.5 pt-2 border-t border-slate-200/60 space-y-1.5">
                    <li v-for="d in step.output_documents" :key="d.id" class="flex items-center justify-between text-xs text-slate-600 pl-8">
                      <span class="truncate flex items-center gap-1.5">
                        <svg class="w-3.5 h-3.5 text-slate-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
                        <span class="font-medium text-slate-700">{{ d.doc_name }}</span>
                      </span>
                      <a v-if="d.file_path" :href="viewUrl(d.id)" target="_blank" rel="noopener"
                        class="text-xs font-semibold text-brand-600 hover:text-brand-800 hover:underline shrink-0 ml-2">
                        View
                      </a>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div class="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-400">
              <svg class="w-4 h-4 text-brand-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
              <span>Municipality approvals are routed and dispatched through the Barangay Secretariat for safe physical custody.</span>
            </div>
          </div>

          <!-- Right column (40-45% width): choice & location form -->
          <div class="lg:col-span-5 p-6 bg-white flex flex-col justify-between">

            <!-- Already confirmed: show tracking status -->
            <template v-if="batchDeliveryDone">
              <div class="space-y-4">
                <span class="text-xs font-bold uppercase tracking-wider text-slate-500">Delivery Status</span>

                <div class="rounded-xl bg-brand-50 border border-brand-200 p-4">
                  <div class="flex items-center gap-2 text-sm font-bold text-brand-800">
                    <svg v-if="batchDeliveryMethod === 'barangay_pickup'" class="w-4 h-4 text-brand-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                    <svg v-else class="w-4 h-4 text-brand-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                    {{ batchDeliveryMethod === 'barangay_pickup' ? 'Pick up at Barangay Hall' : 'Delivering to Address' }}
                  </div>
                  <p class="text-xs text-brand-900 mt-1.5 leading-relaxed">
                    <strong class="font-semibold text-slate-700">Location:</strong>
                    {{ batchOutputSteps.find(s => s.delivery_address)?.delivery_address || 'Registered Address' }}
                  </p>
                  <p v-if="batchOutputSteps.find(s => s.delivery_landmarks)?.delivery_landmarks" class="text-xs text-slate-600 mt-1">
                    <strong class="font-semibold text-slate-700">Landmarks:</strong>
                    {{ batchOutputSteps.find(s => s.delivery_landmarks)?.delivery_landmarks }}
                  </p>
                </div>

                <div class="text-xs text-slate-500 leading-relaxed">
                  Your delivery option applies to all approved files above. The Barangay Secretariat will coordinate with you once the packet arrives.
                </div>
              </div>
            </template>

            <!-- Not yet chosen: show options from wireframe -->
            <template v-else>
              <div class="space-y-4">
                <span class="text-xs font-bold uppercase tracking-wider text-slate-500">Choose Delivery Option</span>

                <!-- Option 1: pick up at barangay hall -->
                <button type="button" @click="batchDeliveryChoice = 'barangay_pickup'"
                  class="w-full text-left rounded-xl border-2 px-4 py-3 transition relative"
                  :class="batchDeliveryChoice === 'barangay_pickup' ? 'border-brand-500 bg-meadow/80 ring-2 ring-brand-500/20' : 'border-slate-200 hover:border-brand-300 bg-white'">
                  <div class="flex items-center justify-between">
                    <div class="font-bold text-slate-800 text-sm flex items-center gap-2">
                      <svg class="w-4 h-4 text-brand-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                      Pick up at barangay hall
                    </div>
                    <span v-if="batchDeliveryChoice === 'barangay_pickup'" class="w-4 h-4 rounded-full bg-brand-600 text-white flex items-center justify-center text-[10px]">✓</span>
                  </div>
                  <div class="text-xs text-slate-500 mt-1 ml-6">Papers ready at your local barangay office.</div>
                </button>

                <!-- Option 2: deliver to my address -->
                <button type="button" @click="batchDeliveryChoice = 'delivery'"
                  class="w-full text-left rounded-xl border-2 px-4 py-3 transition relative"
                  :class="batchDeliveryChoice === 'delivery' ? 'border-brand-500 bg-meadow/80 ring-2 ring-brand-500/20' : 'border-slate-200 hover:border-brand-300 bg-white'">
                  <div class="flex items-center justify-between">
                    <div class="font-bold text-slate-800 text-sm flex items-center gap-2">
                      <svg class="w-4 h-4 text-brand-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                      Deliver to my address
                    </div>
                    <span v-if="batchDeliveryChoice === 'delivery'" class="w-4 h-4 rounded-full bg-brand-600 text-white flex items-center justify-center text-[10px]">✓</span>
                  </div>
                  <div class="text-xs text-slate-500 mt-1 ml-6">Free dispatch to your registered address.</div>
                </button>

                <!-- Location information box (wireframe: location information) -->
                <div>
                  <div class="flex items-center justify-between mb-1">
                    <label class="block text-xs font-bold text-slate-700">Location Information</label>
                    <span class="text-[10px] text-slate-400">Auto-populated from account</span>
                  </div>
                  <textarea v-model="batchDeliveryAddress" rows="3"
                    class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs placeholder:text-slate-400 focus:ring-4 focus:ring-brand-600/15 focus:border-brand-600 outline-none transition"
                    placeholder="Enter full address..."></textarea>
                </div>

                <!-- Additional info (wireframe: additional info, if deliver to address, like landmarks) -->
                <div v-if="batchDeliveryChoice === 'delivery'">
                  <label class="block text-xs font-bold text-slate-700 mb-1">
                    Additional Info <span class="font-normal text-slate-400">(Landmarks, gate, unit #)</span>
                  </label>
                  <textarea v-model="batchDeliveryLandmarks" rows="2"
                    class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs placeholder:text-slate-400 focus:ring-4 focus:ring-brand-600/15 focus:border-brand-600 outline-none transition"
                    placeholder="e.g. In front of elementary school, blue gate..."></textarea>
                </div>

                <p v-if="batchDeliveryError" class="text-xs text-red-600">{{ batchDeliveryError }}</p>
              </div>

              <!-- Confirm delivery button aligned bottom-right as per wireframe -->
              <div class="mt-6 pt-4 border-t border-slate-100 flex justify-end">
                <button type="button" @click="chooseBatchDelivery" :disabled="batchDeliverySaving || !batchDeliveryChoice"
                  class="inline-flex items-center justify-center text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 px-6 py-2.5 rounded-xl transition shadow-sm">
                  {{ batchDeliverySaving ? 'Saving…' : 'Confirm delivery' }}
                </button>
              </div>
            </template>
          </div>
        </div>
      </div>


      <div class="grid lg:grid-cols-2 gap-6 mt-6">
        <div class="bg-white rounded-xl border border-slate-200 p-6">
          <h2 class="font-bold text-ink-700 mb-4">Submitted Documents</h2>
          <ul class="divide-y divide-slate-100">
            <li v-for="doc in app.documents" :key="doc.id" class="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div class="flex items-start gap-2.5 min-w-0">
                <svg v-if="doc.status === 'Verified'" class="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                <svg v-else-if="doc.status === 'Needs Re-upload'" class="w-4 h-4 text-red-500 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg>
                <svg v-else class="w-4 h-4 text-slate-300 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/></svg>
                <div class="min-w-0">
                  <div class="flex items-center gap-1.5">
                    <div class="text-sm font-semibold text-slate-800 truncate">{{ doc.doc_name }}</div>
                    <span v-if="doc.version > 1" class="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">v{{ doc.version }}</span>
                  </div>
                  <div class="text-xs" :class="doc.status === 'Verified' ? 'text-emerald-600' : doc.status === 'Needs Re-upload' ? 'text-red-500' : 'text-slate-400'">
                    {{ doc.status === 'Verified' ? 'Verified' : doc.status === 'Needs Re-upload' ? (doc.decision_type === 'revision' ? 'Needs a revision' : 'Needs a new copy') : doc.status === 'Intake Approved' ? 'Checked by your barangay, with the city office' : doc.status === 'Pending Review' ? 'Uploaded, pending review' : 'Not uploaded yet' }}
                  </div>
                  <!-- What is actually wrong with it, rather than sending them to hunt the activity feed -->
                  <div v-if="doc.status === 'Needs Re-upload' && doc.reject_reason"
                       class="mt-1.5 rounded-lg bg-red-50 border border-red-100 px-2.5 py-1.5 text-xs leading-snug">
                    <span class="font-semibold text-red-700">{{ rejectReasonLabel(doc.reject_reason) }}</span>
                    <span v-if="doc.reject_notes" class="text-slate-600"> — {{ doc.reject_notes }}</span>
                  </div>
                  <div v-if="doc.uploaded_at" class="text-xs text-slate-400 mt-0.5">Uploaded {{ formatDateTime(doc.uploaded_at) }}</div>
                  <button v-if="doc.previous_versions && doc.previous_versions.length" type="button" @click="toggleHistory(doc.id)"
                    class="text-xs font-semibold text-slate-400 hover:text-slate-600 mt-1">
                    {{ expandedHistory[doc.id] ? 'Hide' : 'Show' }} revision history ({{ doc.previous_versions.length }})
                  </button>
                  <ul v-if="expandedHistory[doc.id]" class="mt-1.5 space-y-1 border-l-2 border-slate-100 pl-2.5">
                    <li v-for="v in doc.previous_versions" :key="v.id" class="text-xs text-slate-500">
                      <span class="font-semibold text-slate-600">v{{ v.version }}</span>
                      <span v-if="v.status === 'Needs Re-upload'" class="text-red-500">— {{ v.decision_type === 'revision' ? 'revision requested' : 'rejected' }}<span v-if="v.reject_reason">: {{ rejectReasonLabel(v.reject_reason) }}</span></span>
                      <span v-else>— {{ v.status }}</span>
                      <span class="text-slate-400"> · {{ formatDateTime(v.uploaded_at) }}</span>
                    </li>
                  </ul>
                </div>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <a v-if="doc.file_path" :href="viewUrl(doc.id)" target="_blank" rel="noopener" class="text-sm font-semibold text-brand-600 hover:underline">View</a>
                <!-- Anything an office hasn't verified yet can still be swapped: the one a
                     reviewer sent back, one never uploaded, and one simply waiting its turn. -->
                <label v-if="doc.status === 'Needs Re-upload' || doc.status === 'Missing'"
                  class="shrink-0 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 px-3 py-1.5 rounded-md cursor-pointer transition">
                  {{ reuploadingId === doc.id ? 'Uploading…' : 'Re-upload' }}
                  <input type="file" class="hidden" :accept="uploadAccept" @change="reupload(doc, $event)" />
                </label>
                <label v-else-if="doc.status !== 'Verified'"
                  class="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold text-ink-700 bg-white ring-1 ring-slate-300 hover:ring-brand-400 hover:text-brand-700 px-3 py-1.5 rounded-full cursor-pointer transition">
                  <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/></svg>
                  {{ reuploadingId === doc.id ? 'Uploading…' : 'Replace' }}
                  <input type="file" class="hidden" :accept="uploadAccept" @change="reupload(doc, $event)" />
                </label>
              </div>
            </li>
          </ul>
          <p v-if="docError" class="mt-3 text-xs text-red-600">{{ docError }}</p>
        </div>

        <ThreadCard :application-id="app.id" :activity="activity" tone="slate" />
      </div>

      <!-- Editing what the applicant can still change: the address and the description. The
           permit type, documents and declarations are what the route was built from, so those
           are not editable — a different permit is a different application. -->
      <BaseModal v-if="editing" title="Edit application" eyebrow="Before a reviewer picks it up"
        :subtitle="app.permit_type || app.permit_type_name" @close="editing = false">
        <template #icon>
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>
        </template>

        <div v-if="editNeedsAddress">
          <label class="block text-xs font-semibold text-slate-600 mb-1" for="edit-address">Property address</label>
          <input id="edit-address" v-model="editForm.property_address" type="text"
            class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:ring-4 focus:ring-brand-600/15 focus:border-brand-600 outline-none transition" />
        </div>
        <div :class="editNeedsAddress ? 'mt-3' : ''">
          <label class="block text-xs font-semibold text-slate-600 mb-1" for="edit-desc">Project description <span class="font-normal text-slate-400">(optional)</span></label>
          <textarea id="edit-desc" v-model="editForm.project_description" rows="3"
            class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:ring-4 focus:ring-brand-600/15 focus:border-brand-600 outline-none transition"></textarea>
        </div>
        <p class="text-xs text-slate-400 mt-2">To change the permit type or its documents, discard this and file again.</p>
        <p v-if="editError" class="text-sm text-red-600 mt-3">{{ editError }}</p>

        <template #footer>
          <div class="ml-auto flex items-center gap-2">
            <button type="button" @click="editing = false" :disabled="saving" class="text-sm font-semibold text-slate-600 px-4 py-2.5 rounded-xl hover:bg-slate-200/60 disabled:opacity-60 transition">Cancel</button>
            <button type="button" @click="saveEdit" :disabled="saving"
              class="text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-60 px-5 py-2.5 rounded-xl transition shadow-[0_8px_18px_-8px_rgba(31,122,58,0.6)]">
              {{ saving ? 'Saving…' : 'Save changes' }}
            </button>
          </div>
        </template>
      </BaseModal>

      <BaseModal v-if="confirmDiscard" title="Discard this application?" eyebrow="It leaves the queue" tone="sun"
        :subtitle="app.permit_type || app.permit_type_name" @close="confirmDiscard = false">
        <template #icon>
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </template>
        <p class="text-sm text-slate-600 leading-relaxed">
          No office will review it any further. The record and its history stay in
          <span class="font-semibold text-ink-700">My Permits</span>, but it can't be put back —
          you'd need to file it again.
        </p>
        <p v-if="discardError" class="text-sm text-red-600 mt-3">{{ discardError }}</p>
        <template #footer>
          <div class="ml-auto flex items-center gap-2">
            <button type="button" @click="confirmDiscard = false" :disabled="discarding" class="text-sm font-semibold text-slate-600 px-4 py-2.5 rounded-xl hover:bg-slate-200/60 disabled:opacity-60 transition">Keep it</button>
            <button type="button" @click="discard" :disabled="discarding"
              class="text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 px-5 py-2.5 rounded-xl transition">
              {{ discarding ? 'Discarding…' : 'Yes, discard it' }}
            </button>
          </div>
        </template>
      </BaseModal>
    </template>
  </AppShell>
  `,
};
