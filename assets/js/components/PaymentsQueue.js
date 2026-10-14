import { apiGet, apiPost } from '../api/client.js?v=168';
import StaffShell from './StaffShell.js?v=168';
import { formatDateTime, formatPeso, permitLabel } from '../util.js?v=168';
import Loader from './Loader.js?v=168';

// Section 3 — the payment-bridge staff view (Barangay Secretary payment role, Municipal
// Treasury; migration 040). Deliberately the only thing these accounts can do here: confirm a
// payment that already went through the applicant's simulated checkout. There is no Approve/
// Reject here — that is a different screen (ReviewDetail.js) for a different kind of account.
export default {
  name: 'PaymentsQueue',
  components: { StaffShell, Loader },
  data() {
    return {
      loading: true,
      payments: [],
      hasPaymentScope: true,
      confirmingId: null,
      error: '',
    };
  },
  async mounted() {
    await this.refresh();
  },
  methods: {
    formatDateTime,
    formatPeso,
    permitLabel,
    async refresh() {
      this.loading = true;
      const res = await apiGet('payments.php?action=queue');
      this.payments = res.payments;
      this.hasPaymentScope = res.has_payment_scope;
      this.loading = false;
    },
    async confirm(p) {
      this.error = '';
      this.confirmingId = p.id;
      try {
        await apiPost('payments.php?action=confirm', { payment_id: p.id });
        await this.refresh();
      } catch (e) {
        this.error = e.message;
      } finally {
        this.confirmingId = null;
      }
    },
  },
  template: `
  <StaffShell>
    <div class="pt-gradient-wide rounded-3xl px-6 py-8 sm:px-10 mb-8 shadow-[0_24px_60px_-28px_rgba(31,122,58,0.7)]">
      <p class="text-sm font-medium text-white/85 mb-2">Payment confirmation</p>
      <h1 class="text-3xl sm:text-4xl font-bold tracking-tight text-white leading-tight">Payments</h1>
      <p class="text-white/85 text-sm mt-2">{{ payments.length }} payment(s) waiting for confirmation.</p>
    </div>

    <Loader v-if="loading" kind="queue" />

    <div v-else-if="!hasPaymentScope" class="bg-white rounded-2xl border border-dashed border-brand-200 p-12 text-center text-slate-500">
      Your account isn't one of the payment-confirmation accounts, so there's nothing to show here.
    </div>

    <div v-else-if="!payments.length" class="bg-white rounded-2xl border border-dashed border-brand-200 p-12 text-center text-slate-500">
      Nothing waiting on you right now.
    </div>

    <div v-else class="space-y-3">
      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
      <div v-for="p in payments" :key="p.id" class="bg-white rounded-2xl border border-brand-100 p-4 flex items-center justify-between gap-4 flex-wrap">
        <div class="min-w-0">
          <div class="font-bold text-ink-700 truncate">{{ p.applicant_name }} &mdash; {{ permitLabel(p.permit_type_name || p.permit_type) }}</div>
          <div class="text-sm text-slate-500 truncate">{{ p.property_address }}</div>
          <div class="text-xs text-slate-400 mt-0.5">{{ p.method === 'bank_transfer' ? 'Bank Transfer' : p.method === 'maya' ? 'Maya' : 'GCash' }} &middot; ref {{ p.reference }} &middot; submitted {{ formatDateTime(p.updated_at) }}</div>
        </div>
        <div class="flex items-center gap-3 shrink-0">
          <span class="text-lg font-extrabold text-ink-700">{{ formatPeso(p.amount) }}</span>
          <button type="button" @click="confirm(p)" :disabled="confirmingId === p.id"
            class="text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-60 px-4 py-2.5 rounded-xl transition">
            {{ confirmingId === p.id ? 'Confirming…' : 'Confirm received' }}
          </button>
        </div>
      </div>
    </div>
  </StaffShell>
  `,
};
