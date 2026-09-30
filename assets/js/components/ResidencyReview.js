import { apiGet, apiPost } from '../api/client.js?v=65';
import StaffShell from './StaffShell.js?v=65';
import { formatDate, backButtonClass, backIconClass } from '../util.js?v=65';
import Loader from './Loader.js?v=65';

export default {
  name: 'ResidencyReview',
  setup: () => ({ backButtonClass, backIconClass }),
  components: { StaffShell, Loader },
  data() {
    return {
      loading: true,
      request: null,
      applicant: null,
      history: [],
      activeProof: 0,
      mode: '', // '' | 'reject'
      reason: '',
      saving: false,
      error: '',
    };
  },
  computed: {
    proof() {
      return this.request ? this.request.proofs[this.activeProof] : null;
    },
    isPending() {
      return this.request && this.request.status === 'pending';
    },
  },
  async mounted() {
    await this.refresh();
  },
  methods: {
    formatDate,
    fileUrl(id) {
      return 'api/residency.php?action=file&id=' + id;
    },
    isImage(p) {
      return p && p.mime_type.startsWith('image/');
    },
    async refresh() {
      this.loading = true;
      const res = await apiGet('residency.php?action=detail&id=' + this.$route.params.id);
      this.request = res.request;
      this.applicant = res.applicant;
      this.history = res.history;
      this.loading = false;
    },
    async decide(decision) {
      this.error = '';
      if (decision === 'reject' && this.reason.trim().length < 5) {
        this.error = 'Please tell the applicant what to fix.';
        return;
      }
      this.saving = true;
      try {
        const res = await apiPost('residency.php?action=decide', { id: this.request.id, decision, reason: this.reason.trim() });
        this.request = res.request;
        this.mode = '';
      } catch (e) {
        this.error = e.message;
      } finally {
        this.saving = false;
      }
    },
  },
  template: `
  <StaffShell>
    <router-link to="/staff/residency" :class="backButtonClass">
      <span :class="backIconClass"><svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg></span>
      Back to Resident Verifications
    </router-link>

    <Loader v-if="loading" kind="review" />

    <template v-else-if="request">
      <div class="pt-gradient-wide rounded-3xl px-6 py-7 sm:px-8 mt-3 shadow-[0_24px_60px_-28px_rgba(31,122,58,0.7)]">
        <p class="text-xs font-bold uppercase tracking-wider text-white/80 mb-1.5">Resident verification #{{ request.id }}</p>
        <h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-white">{{ applicant.full_name }}</h1>
        <div class="text-sm text-white/85 mt-1">Submitted {{ formatDate(request.created_at) }}</div>
      </div>

      <div class="grid lg:grid-cols-3 gap-6 mt-6">
        <div class="lg:col-span-2 space-y-6">
          <!-- Documents viewer -->
          <div class="bg-white rounded-2xl border border-brand-100 p-6">
            <div class="flex items-center justify-between gap-3 flex-wrap mb-4">
              <h2 class="font-bold text-ink-700">Proofs of residence</h2>
              <div class="flex rounded-full bg-meadow p-1" role="tablist" aria-label="Proofs">
                <button v-for="(p, i) in request.proofs" :key="p.id" type="button" role="tab" :aria-selected="activeProof === i" @click="activeProof = i"
                  class="px-4 py-1.5 rounded-full text-sm font-semibold transition" :class="activeProof === i ? 'bg-white shadow text-brand-700' : 'text-slate-500'">
                  Proof #{{ i + 1 }}
                </button>
              </div>
            </div>
            <template v-if="proof">
              <div class="flex items-center justify-between gap-3 flex-wrap mb-3">
                <div>
                  <div class="font-semibold text-slate-800">{{ proof.doc_type_label }}</div>
                  <div class="text-sm text-slate-500">
                    <template v-if="proof.issued_on">Issued {{ formatDate(proof.issued_on) }} ({{ proof.age_days }} day(s) old) · </template>{{ proof.original_filename }}
                  </div>
                </div>
                <a :href="fileUrl(proof.id)" target="_blank" rel="noopener" class="text-sm font-semibold text-brand-700 hover:underline">Open in new tab ↗</a>
              </div>
              <div class="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
                <img v-if="isImage(proof)" :src="fileUrl(proof.id)" :alt="proof.doc_type_label" class="w-full max-h-[560px] object-contain" />
                <iframe v-else :src="fileUrl(proof.id)" :title="proof.doc_type_label" class="w-full h-[560px]"></iframe>
              </div>
            </template>
          </div>

          <div v-if="history.length" class="bg-white rounded-2xl border border-brand-100 p-6">
            <h2 class="font-bold text-ink-700 mb-3">Earlier requests</h2>
            <ul class="divide-y divide-slate-100">
              <li v-for="h in history" :key="h.id" class="py-3 first:pt-0 last:pb-0 text-sm">
                <span class="font-semibold" :class="h.status === 'approved' ? 'text-brand-700' : h.status === 'rejected' ? 'text-red-600' : 'text-sun-700'">{{ h.status }}</span>
                <span class="text-slate-500"> · submitted {{ formatDate(h.created_at) }}</span>
                <p v-if="h.rejection_reason" class="text-slate-600 mt-0.5">“{{ h.rejection_reason }}”</p>
              </li>
            </ul>
          </div>
        </div>

        <div class="space-y-6">
          <!-- What to compare against -->
          <div class="bg-white rounded-2xl border border-brand-100 p-6">
            <h2 class="font-bold text-ink-700 mb-4">Check against</h2>
            <dl class="space-y-3 text-sm">
              <div><dt class="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-0.5">Name</dt><dd class="font-semibold text-slate-800">{{ applicant.full_name }}</dd></div>
              <div><dt class="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-0.5">Address declared</dt>
                <dd class="font-semibold text-slate-800">{{ request.address_line }}, Brgy. {{ request.barangay }}, {{ request.city }} {{ request.postal_code }}</dd></div>
              <div><dt class="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-0.5">Date of birth</dt><dd class="font-semibold text-slate-800">{{ applicant.birthdate ? formatDate(applicant.birthdate) : '—' }}</dd></div>
              <div><dt class="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-0.5">Email</dt><dd class="font-semibold text-slate-800 break-all">{{ applicant.email || '—' }} <span v-if="applicant.email_verified_at" class="text-brand-700">✓</span></dd></div>
              <div><dt class="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-0.5">Mobile</dt><dd class="font-semibold text-slate-800">{{ applicant.phone || '—' }} <span v-if="applicant.phone_verified_at" class="text-brand-700">✓</span></dd></div>
              <div><dt class="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-0.5">Account created</dt><dd class="font-semibold text-slate-800">{{ formatDate(applicant.created_at) }}</dd></div>
            </dl>
          </div>

          <!-- Decision -->
          <div class="bg-white rounded-2xl border border-brand-100 p-6 lg:sticky lg:top-24">
            <h2 class="font-bold text-ink-700 mb-4">Decision</h2>

            <div v-if="!isPending" class="rounded-xl p-4" :class="request.status === 'approved' ? 'bg-brand-50' : 'bg-red-50'">
              <div class="font-bold" :class="request.status === 'approved' ? 'text-brand-700' : 'text-red-700'">{{ request.status === 'approved' ? 'Approved' : 'Rejected' }}</div>
              <div class="text-sm text-slate-600 mt-0.5">by {{ request.reviewer_name || 'staff' }} on {{ formatDate(request.reviewed_at) }}</div>
              <p v-if="request.rejection_reason" class="text-sm text-slate-700 mt-2">“{{ request.rejection_reason }}”</p>
            </div>

            <template v-else>
              <ul class="text-sm text-slate-600 space-y-1.5 mb-5">
                <li>• The name on both proofs matches the applicant</li>
                <li>• The address matches what they declared</li>
                <li>• Dated documents are recent enough</li>
              </ul>

              <template v-if="mode === 'reject'">
                <label class="block text-sm font-semibold text-slate-700 mb-1" for="reject-reason">Reason <span class="text-slate-400 font-normal">(sent to the applicant)</span></label>
                <textarea id="reject-reason" v-model="reason" rows="3" placeholder="e.g. The utility bill is in a different name. Please upload one in your name."
                  class="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm placeholder:text-slate-400 focus:ring-4 focus:ring-red-500/15 focus:border-red-500 outline-none transition"></textarea>
                <p v-if="error" class="text-sm text-red-600 mt-2" role="alert">{{ error }}</p>
                <div class="flex gap-2 mt-3">
                  <button type="button" @click="mode = ''; error = ''" class="px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
                  <button type="button" @click="decide('reject')" :disabled="saving" class="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-60">
                    {{ saving ? 'Saving…' : 'Reject & notify' }}
                  </button>
                </div>
              </template>
              <template v-else>
                <p v-if="error" class="text-sm text-red-600 mb-3" role="alert">{{ error }}</p>
                <button type="button" @click="decide('approve')" :disabled="saving"
                  class="w-full py-3 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-60 transition shadow-[0_12px_24px_-8px_rgba(31,122,58,0.55)]">
                  {{ saving ? 'Saving…' : 'Approve as Resident' }}
                </button>
                <button type="button" @click="mode = 'reject'" class="w-full mt-2 py-2.5 rounded-xl border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 transition">Reject…</button>
              </template>
            </template>
          </div>
        </div>
      </div>
    </template>
  </StaffShell>
  `,
};
