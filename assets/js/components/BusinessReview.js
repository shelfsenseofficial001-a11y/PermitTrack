import { apiGet, apiPost } from '../api/client.js?v=70';
import StaffShell from './StaffShell.js?v=70';
import { formatDate } from '../util.js?v=70';
import Loader from './Loader.js?v=70';

export default {
  name: 'BusinessReview',
  components: { StaffShell, Loader },
  data() {
    return {
      loading: true,
      business: null,
      owner: null,
      history: [],
      activeDoc: 0,
      mode: '',
      reason: '',
      saving: false,
      error: '',
    };
  },
  computed: {
    doc() {
      return this.business ? this.business.documents[this.activeDoc] : null;
    },
    isPending() {
      return this.business && this.business.status === 'pending';
    },
  },
  async mounted() {
    const res = await apiGet('business.php?action=detail&id=' + this.$route.params.id);
    this.business = res.business;
    this.owner = res.owner;
    this.history = res.history;
    this.loading = false;
  },
  methods: {
    formatDate,
    fileUrl(id) {
      return 'api/business.php?action=file&id=' + id;
    },
    historyLabel(action) {
      return { 'business.submitted': 'Submitted', 'business.resubmitted': 'Resubmitted', 'business.approved': 'Approved', 'business.rejected': 'Rejected' }[action] || action;
    },
    async decide(decision) {
      this.error = '';
      if (decision === 'reject' && this.reason.trim().length < 5) {
        this.error = 'Please tell the applicant what to fix.';
        return;
      }
      this.saving = true;
      try {
        const res = await apiPost('business.php?action=decide', { id: this.business.id, decision, reason: this.reason.trim() });
        this.business = res.business;
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
    <router-link to="/staff/businesses" class="text-sm font-medium text-slate-500 hover:text-brand-700">‹ Back to Business Verifications</router-link>
    <Loader v-if="loading" kind="review" />

    <template v-else-if="business">
      <div class="pt-gradient-wide rounded-3xl px-6 py-7 sm:px-8 mt-3 shadow-[0_24px_60px_-28px_rgba(31,122,58,0.7)]">
        <p class="text-xs font-bold uppercase tracking-wider text-white/80 mb-1.5">Business verification #{{ business.id }} · {{ business.ownership_label }}</p>
        <h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-white">{{ business.business_name }}</h1>
        <div class="text-sm text-white/85 mt-1">Submitted {{ formatDate(business.submitted_at) }} by {{ owner.full_name }}</div>
      </div>

      <div class="grid lg:grid-cols-3 gap-6 mt-6">
        <div class="lg:col-span-2 space-y-6 min-w-0">
          <div class="bg-white rounded-2xl border border-brand-100 p-6">
            <h2 class="font-bold text-ink-700 mb-3">Documents</h2>
            <div class="flex flex-wrap gap-2 mb-4" role="tablist" aria-label="Documents">
              <button v-for="(d, i) in business.documents" :key="d.id" type="button" role="tab" :aria-selected="activeDoc === i" @click="activeDoc = i"
                class="px-3 py-1.5 rounded-full text-xs font-semibold border transition"
                :class="activeDoc === i ? 'bg-brand-600 border-brand-600 text-white' : 'border-slate-300 text-slate-600 hover:border-brand-300'">
                {{ d.label.split(' (')[0] }}
              </button>
            </div>
            <template v-if="doc">
              <div class="flex items-center justify-between gap-3 flex-wrap mb-3">
                <div>
                  <div class="font-semibold text-slate-800">{{ doc.label }}</div>
                  <div class="text-sm text-slate-500"><template v-if="doc.id_type_label">{{ doc.id_type_label }} · </template>{{ doc.original_filename }} · uploaded {{ formatDate(doc.uploaded_at) }}</div>
                </div>
                <a :href="fileUrl(doc.id)" target="_blank" rel="noopener" class="text-sm font-semibold text-brand-700 hover:underline">Open in new tab ↗</a>
              </div>
              <div class="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
                <img v-if="doc.mime_type.startsWith('image/')" :src="fileUrl(doc.id)" :alt="doc.label" class="w-full max-h-[560px] object-contain" />
                <iframe v-else :src="fileUrl(doc.id)" :title="doc.label" class="w-full h-[560px]"></iframe>
              </div>
            </template>
          </div>

          <div v-if="history.length" class="bg-white rounded-2xl border border-brand-100 p-6">
            <h2 class="font-bold text-ink-700 mb-3">History</h2>
            <ul class="divide-y divide-slate-100 text-sm">
              <li v-for="(h, i) in history" :key="i" class="py-2.5">
                <span class="font-semibold text-slate-700">{{ historyLabel(h.action) }}</span>
                <span class="text-slate-500"> · {{ formatDate(h.created_at) }} by {{ h.actor || 'unknown' }}</span>
                <p v-if="h.details" class="text-slate-600">“{{ h.details }}”</p>
              </li>
            </ul>
          </div>
        </div>

        <div class="space-y-6">
          <div class="bg-white rounded-2xl border border-brand-100 p-6">
            <h2 class="font-bold text-ink-700 mb-4">Business details</h2>
            <dl class="space-y-2.5 text-sm">
              <div><dt class="text-slate-400 text-xs font-semibold uppercase">Registered name</dt><dd class="font-semibold text-slate-800">{{ business.business_name }}</dd></div>
              <div v-if="business.trade_name"><dt class="text-slate-400 text-xs font-semibold uppercase">Trade name</dt><dd class="font-semibold text-slate-800">{{ business.trade_name }}</dd></div>
              <div><dt class="text-slate-400 text-xs font-semibold uppercase">Registration no.</dt><dd class="font-semibold text-slate-800">{{ business.registration_number }}</dd></div>
              <div><dt class="text-slate-400 text-xs font-semibold uppercase">TIN</dt><dd class="font-semibold text-slate-800">{{ business.tin }}</dd></div>
              <div><dt class="text-slate-400 text-xs font-semibold uppercase">Line of business</dt><dd class="font-semibold text-slate-800">{{ business.line_of_business }}</dd></div>
              <div><dt class="text-slate-400 text-xs font-semibold uppercase">Location</dt><dd class="font-semibold text-slate-800">{{ business.address_line }}, Brgy. {{ business.barangay }}, {{ business.city }} {{ business.postal_code }}</dd></div>
              <div v-if="business.floor_area_sqm || business.employee_count"><dt class="text-slate-400 text-xs font-semibold uppercase">Size</dt>
                <dd class="font-semibold text-slate-800"><template v-if="business.floor_area_sqm">{{ business.floor_area_sqm }} sq m</template><template v-if="business.employee_count"> · {{ business.employee_count }} employee(s)</template></dd></div>
              <div v-if="business.business_email || business.business_phone"><dt class="text-slate-400 text-xs font-semibold uppercase">Business contact</dt><dd class="font-semibold text-slate-800 break-all">{{ business.business_email }} {{ business.business_phone }}</dd></div>
            </dl>
            <h3 class="font-bold text-ink-700 mt-5 mb-2">Representative</h3>
            <dl class="space-y-2.5 text-sm">
              <div><dt class="text-slate-400 text-xs font-semibold uppercase">Name (must match the ID)</dt><dd class="font-semibold text-slate-800">{{ owner.full_name }}</dd></div>
              <div><dt class="text-slate-400 text-xs font-semibold uppercase">Role</dt><dd class="font-semibold text-slate-800">{{ business.representative_role || (business.is_registered_owner ? 'Registered owner' : '—') }}</dd></div>
              <div><dt class="text-slate-400 text-xs font-semibold uppercase">Contacts</dt><dd class="font-semibold text-slate-800 break-all">{{ owner.email || '—' }} {{ owner.email_verified_at ? '✓' : '' }} · {{ owner.phone || '—' }} {{ owner.phone_verified_at ? '✓' : '' }}</dd></div>
              <div><dt class="text-slate-400 text-xs font-semibold uppercase">Resident status</dt><dd class="font-semibold text-slate-800">{{ owner.resident_status === 'verified' ? 'Verified Resident' : 'Not a verified Resident' }}</dd></div>
            </dl>
          </div>

          <div class="bg-white rounded-2xl border border-brand-100 p-6 lg:sticky lg:top-24">
            <h2 class="font-bold text-ink-700 mb-4">Decision</h2>
            <div v-if="!isPending" class="rounded-xl p-4" :class="business.status === 'approved' ? 'bg-brand-50' : 'bg-red-50'">
              <div class="font-bold" :class="business.status === 'approved' ? 'text-brand-700' : 'text-red-700'">{{ business.status === 'approved' ? 'Approved' : 'Rejected' }}</div>
              <div class="text-sm text-slate-600">by {{ business.reviewer_name || 'staff' }} on {{ formatDate(business.reviewed_at) }}</div>
              <p v-if="business.rejection_reason" class="text-sm text-slate-700 mt-2">“{{ business.rejection_reason }}”</p>
            </div>
            <template v-else>
              <ul class="text-sm text-slate-600 space-y-1.5 mb-5">
                <li>• Registration certificate matches the name and number</li>
                <li>• ID name matches the registration (or authority doc names them)</li>
                <li>• Location documents match the business address</li>
              </ul>
              <template v-if="mode === 'reject'">
                <label class="block text-sm font-semibold text-slate-700 mb-1" for="biz-reason">Reason <span class="text-slate-400 font-normal">(sent to the applicant)</span></label>
                <textarea id="biz-reason" v-model="reason" rows="3" class="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-red-500"></textarea>
                <p v-if="error" class="text-sm text-red-600 mt-2" role="alert">{{ error }}</p>
                <div class="flex gap-2 mt-3">
                  <button type="button" @click="mode = ''; error = ''" class="px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-600">Cancel</button>
                  <button type="button" @click="decide('reject')" :disabled="saving" class="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold disabled:opacity-60">{{ saving ? 'Saving…' : 'Reject & notify' }}</button>
                </div>
              </template>
              <template v-else>
                <p v-if="error" class="text-sm text-red-600 mb-3" role="alert">{{ error }}</p>
                <button type="button" @click="decide('approve')" :disabled="saving" class="w-full py-3 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-60">{{ saving ? 'Saving…' : 'Approve business' }}</button>
                <button type="button" @click="mode = 'reject'" class="w-full mt-2 py-2.5 rounded-xl border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50">Reject…</button>
              </template>
            </template>
          </div>
        </div>
      </div>
    </template>
  </StaffShell>
  `,
};
