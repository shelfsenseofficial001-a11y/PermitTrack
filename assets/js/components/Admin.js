import { apiGet, apiPost } from '../api/client.js?v=68';
import StaffShell from './StaffShell.js?v=68';
import { formatDate } from '../util.js?v=68';
import Loader from './Loader.js?v=68';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'staff', label: 'Staff' },
  { key: 'departments', label: 'Departments' },
  { key: 'users', label: 'Public accounts' },
  { key: 'chatbot', label: 'Chat bot' },
  { key: 'audit', label: 'Audit log' },
];

const inputClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-4 focus:ring-brand-600/15 focus:border-brand-600 outline-none';

const AUDIT_LABELS = {
  'residency.submitted': 'Submitted residency proofs',
  'residency.approved': 'Approved residency',
  'residency.rejected': 'Rejected residency',
  'business.submitted': 'Submitted a business',
  'business.resubmitted': 'Resubmitted a business',
  'business.approved': 'Approved a business',
  'business.rejected': 'Rejected a business',
  'admin.staff_created': 'Created staff account',
  'admin.staff_updated': 'Updated staff account',
  'admin.account_deactivated': 'Deactivated account',
  'admin.account_reactivated': 'Reactivated account',
  'admin.password_reset': 'Reset password',
  'admin.department_created': 'Created department',
  'admin.department_updated': 'Updated department',
  'admin.faq_created': 'Added a chat bot answer',
  'admin.faq_updated': 'Edited a chat bot answer',
};

export default {
  name: 'Admin',
  components: { StaffShell, Loader },
  data() {
    return {
      tabs: TABS,
      inputClass,
      loading: false,
      error: '',
      notice: '',
      // Shown once after creating a user or resetting a password
      tempPassword: null, // { name, password }
      summary: null,
      staff: [],
      me: 0,
      departments: [],
      permitTypes: [],
      users: [],
      userQuery: '',
      userFilter: 'all',
      audit: { entries: [], total: 0, page: 1, per_page: 50 },
      auditCategory: '',
      auditActor: '',
      newStaff: { first_name: '', last_name: '', email: '', role: 'staff', department_id: '' },
      editingStaff: null, // copy of a staff row being edited
      editingDept: null,  // copy of a department being edited / created
      faq: { faqs: [], stats: {}, unanswered: [] },
      editingFaq: null,
      testMessage: '',
      testReply: null,
    };
  },
  computed: {
    tab() {
      return TABS.some((t) => t.key === this.$route.params.tab) ? this.$route.params.tab : 'overview';
    },
    activeDepartments() {
      return this.departments.filter((d) => Number(d.is_active));
    },
    auditPages() {
      return Math.max(1, Math.ceil(this.audit.total / this.audit.per_page));
    },
  },
  watch: {
    tab: { handler: 'load', immediate: true },
  },
  methods: {
    formatDate,
    auditLabel(action) {
      return AUDIT_LABELS[action] || action;
    },
    flash(message) {
      this.notice = message;
      setTimeout(() => { if (this.notice === message) this.notice = ''; }, 4000);
    },
    async run(fn) {
      this.error = '';
      try {
        await fn();
      } catch (e) {
        this.error = e.message;
      }
    },
    async load() {
      this.error = '';
      this.loading = true;
      try {
        if (this.tab === 'overview') this.summary = await apiGet('admin.php?action=summary');
        if (this.tab === 'staff' || this.tab === 'departments') {
          const d = await apiGet('admin.php?action=departments');
          this.departments = d.departments;
          this.permitTypes = d.permit_types;
        }
        if (this.tab === 'staff') {
          const s = await apiGet('admin.php?action=staff');
          this.staff = s.staff;
          this.me = s.me;
        }
        if (this.tab === 'users') await this.loadUsers();
        if (this.tab === 'audit') await this.loadAudit(1);
        if (this.tab === 'chatbot') this.faq = await apiGet('admin.php?action=faq');
      } catch (e) {
        this.error = e.message;
      } finally {
        this.loading = false;
      }
    },
    async loadUsers() {
      const res = await apiGet(`admin.php?action=users&filter=${this.userFilter}&q=${encodeURIComponent(this.userQuery.trim())}`);
      this.users = res.users;
    },
    async loadAudit(page) {
      const res = await apiGet(`admin.php?action=audit&page=${page}&category=${this.auditCategory}&actor=${encodeURIComponent(this.auditActor.trim())}`);
      this.audit = res;
    },

    // --- Staff ---
    createStaff() {
      return this.run(async () => {
        const res = await apiPost('admin.php?action=staff_create', this.newStaff);
        this.tempPassword = { name: this.newStaff.first_name + ' ' + this.newStaff.last_name, email: this.newStaff.email, password: res.temporary_password };
        this.newStaff = { first_name: '', last_name: '', email: '', role: 'staff', department_id: '' };
        await this.load();
      });
    },
    startEditStaff(s) {
      this.editingStaff = { ...s, department_id: s.department_id || '' };
    },
    saveStaff() {
      return this.run(async () => {
        await apiPost('admin.php?action=staff_update', this.editingStaff);
        this.editingStaff = null;
        this.flash('Staff account updated.');
        await this.load();
      });
    },
    setActive(account, active) {
      let reason = '';
      if (!active) {
        reason = window.prompt(`Deactivate ${account.full_name}? They will be signed out and can't log in.\n\nReason (kept in the audit log):`);
        if (reason === null) return;
      }
      return this.run(async () => {
        await apiPost('admin.php?action=set_active', { id: account.id, active, reason });
        this.flash(active ? 'Account reactivated.' : 'Account deactivated.');
        this.tab === 'users' ? await this.loadUsers() : await this.load();
      });
    },
    resetPassword(account) {
      if (!window.confirm(`Reset the password for ${account.full_name}? Their current password stops working immediately.`)) return;
      return this.run(async () => {
        const res = await apiPost('admin.php?action=reset_password', { id: account.id });
        this.tempPassword = { name: account.full_name, email: account.email || account.phone, password: res.temporary_password };
        this.tab === 'users' ? await this.loadUsers() : await this.load();
      });
    },
    copyTemp() {
      navigator.clipboard && navigator.clipboard.writeText(this.tempPassword.password);
      this.flash('Temporary password copied.');
    },

    // --- Chat bot ---
    startEditFaq(f, question = '') {
      this.editingFaq = f
        ? { ...f, is_active: !!Number(f.is_active) }
        : { id: 0, category: 'General', question, question_tl: '', answer: '', answer_tl: '', keywords: question.toLowerCase(), link_path: '', link_label: '', sort_order: 200, is_active: true };
      this.$nextTick(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    },
    saveFaq() {
      return this.run(async () => {
        await apiPost('admin.php?action=faq_save', this.editingFaq);
        this.editingFaq = null;
        this.flash('Chat bot answer saved.');
        this.faq = await apiGet('admin.php?action=faq');
      });
    },
    testFaq() {
      return this.run(async () => {
        this.testReply = (await apiPost('admin.php?action=faq_test', { message: this.testMessage })).reply;
      });
    },

    // --- Departments ---
    startEditDept(d) {
      this.editingDept = d ? { ...d, permit_types: [...d.permit_types], is_active: !!Number(d.is_active) }
        : { id: 0, name: '', code: '', description: '', permit_types: [], is_active: true };
    },
    saveDept() {
      return this.run(async () => {
        await apiPost('admin.php?action=department_save', this.editingDept);
        this.editingDept = null;
        this.flash('Department saved.');
        await this.load();
      });
    },
  },
  template: `
  <StaffShell>
    <div class="pt-gradient-wide rounded-3xl px-6 py-7 sm:px-10 mb-6 shadow-[0_24px_60px_-28px_rgba(31,122,58,0.7)]">
      <p class="text-sm font-medium text-white/85 mb-1">Superadmin</p>
      <h1 class="text-3xl font-bold tracking-tight text-white">Admin</h1>
      <p class="text-white/85 text-sm mt-1">Manage staff, departments and accounts. Every change here is recorded in the audit log.</p>
    </div>

    <nav class="flex flex-wrap gap-2 mb-6" aria-label="Admin sections">
      <router-link v-for="t in tabs" :key="t.key" :to="'/admin/' + t.key"
        class="px-4 py-2 rounded-full text-sm font-semibold border transition"
        :class="tab === t.key ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-brand-100 text-slate-600 hover:border-brand-300'">{{ t.label }}</router-link>
    </nav>

    <p v-if="error" class="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700" role="alert">{{ error }}</p>
    <p v-if="notice" class="mb-4 rounded-xl bg-brand-50 border border-brand-200 px-4 py-3 text-sm text-brand-700" role="status">{{ notice }}</p>

    <!-- One-time temporary password -->
    <div v-if="tempPassword" class="mb-6 rounded-2xl border-2 border-sun-400 bg-sun-50 p-5">
      <div class="font-bold text-ink-700">Temporary password for {{ tempPassword.name }}</div>
      <p class="text-sm text-slate-600 mt-1">Give this to them privately. It's shown only once — they'll be asked to choose their own password when they sign in{{ tempPassword.email ? ' as ' + tempPassword.email : '' }}.</p>
      <div class="flex items-center gap-3 mt-3 flex-wrap">
        <code class="text-lg font-bold tracking-wider bg-white border border-sun-300 rounded-lg px-4 py-2">{{ tempPassword.password }}</code>
        <button type="button" @click="copyTemp" class="px-3 py-2 rounded-lg bg-ink-700 text-white text-sm font-semibold">Copy</button>
        <button type="button" @click="tempPassword = null" class="px-3 py-2 rounded-lg border border-slate-300 text-sm font-semibold text-slate-600">Done</button>
      </div>
    </div>

    <Loader v-if="loading" kind="admin" />

    <!-- Overview -->
    <div v-else-if="tab === 'overview' && summary" class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <router-link to="/admin/staff" class="bg-white rounded-2xl border border-brand-100 p-5 hover:border-brand-300"><div class="text-xs font-semibold uppercase text-slate-500">Active staff</div><div class="text-3xl font-bold text-ink-700">{{ summary.staff }}</div><div class="text-xs text-slate-400">+ {{ summary.admins }} admin(s)</div></router-link>
      <router-link to="/admin/users" class="bg-white rounded-2xl border border-brand-100 p-5 hover:border-brand-300"><div class="text-xs font-semibold uppercase text-slate-500">Public accounts</div><div class="text-3xl font-bold text-ink-700">{{ summary.public_accounts }}</div><div class="text-xs text-slate-400">{{ summary.residents }} resident(s) · {{ summary.verified_businesses }} verified business(es)</div></router-link>
      <div class="bg-white rounded-2xl border border-brand-100 p-5"><div class="text-xs font-semibold uppercase text-slate-500">Waiting verifications</div><div class="text-3xl font-bold" :class="summary.pending_verifications ? 'text-sun-700' : 'text-ink-700'">{{ summary.pending_verifications }}</div><div class="text-xs text-slate-400">residents + businesses</div></div>
      <div class="bg-white rounded-2xl border border-brand-100 p-5"><div class="text-xs font-semibold uppercase text-slate-500">Open permit applications</div><div class="text-3xl font-bold text-ink-700">{{ summary.open_applications }}</div><div class="text-xs text-slate-400">{{ summary.deactivated }} deactivated account(s)</div></div>
    </div>

    <!-- Staff -->
    <div v-else-if="tab === 'staff'" class="grid lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2 bg-white rounded-2xl border border-brand-100 p-5 overflow-x-auto">
        <h2 class="font-bold text-ink-700 mb-3">Staff accounts</h2>
        <table class="w-full text-sm">
          <thead><tr class="text-left text-xs uppercase text-slate-400"><th class="py-2 pr-3">Name</th><th class="pr-3">Role</th><th class="pr-3">Department</th><th class="pr-3">Last sign-in</th><th></th></tr></thead>
          <tbody>
            <template v-for="s in staff" :key="s.id">
              <tr class="border-t border-slate-100 align-top" :class="Number(s.is_active) ? '' : 'opacity-60'">
                <td class="py-3 pr-3">
                  <div class="font-semibold text-slate-800">{{ s.full_name }} <span v-if="s.id === me" class="text-xs text-brand-700">(you)</span></div>
                  <div class="text-xs text-slate-500">{{ s.email }}</div>
                  <div class="flex gap-1 mt-1">
                    <span v-if="!Number(s.is_active)" class="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">Deactivated</span>
                    <span v-if="Number(s.must_change_password)" class="text-[11px] font-bold px-2 py-0.5 rounded-full bg-sun-100 text-sun-700">Temp password</span>
                  </div>
                </td>
                <td class="py-3 pr-3"><span class="text-xs font-bold px-2 py-1 rounded-full" :class="s.role === 'admin' ? 'bg-ink-700 text-white' : 'bg-brand-100 text-brand-700'">{{ s.role === 'admin' ? 'Admin' : 'City Staff' }}</span></td>
                <td class="py-3 pr-3 text-slate-600">{{ s.role === 'admin' ? 'All departments' : (s.department_name || 'All (no department)') }}</td>
                <td class="py-3 pr-3 text-slate-500">{{ s.last_login_at ? formatDate(s.last_login_at) : 'Never' }}</td>
                <td class="py-3 text-right whitespace-nowrap">
                  <button type="button" @click="startEditStaff(s)" class="text-xs font-semibold text-brand-700 hover:underline">Edit</button>
                  <template v-if="s.id !== me">
                    · <button type="button" @click="resetPassword(s)" class="text-xs font-semibold text-slate-600 hover:underline">Reset password</button>
                    · <button type="button" @click="setActive(s, !Number(s.is_active))" class="text-xs font-semibold hover:underline" :class="Number(s.is_active) ? 'text-red-600' : 'text-brand-700'">{{ Number(s.is_active) ? 'Deactivate' : 'Reactivate' }}</button>
                  </template>
                </td>
              </tr>
              <tr v-if="editingStaff && editingStaff.id === s.id">
                <td colspan="5" class="pb-4">
                  <form @submit.prevent="saveStaff" class="grid sm:grid-cols-4 gap-2 rounded-xl bg-meadow p-3">
                    <input v-model="editingStaff.first_name" :class="inputClass" aria-label="First name" />
                    <input v-model="editingStaff.last_name" :class="inputClass" aria-label="Last name" />
                    <select v-model="editingStaff.role" :class="inputClass" aria-label="Role" :disabled="s.id === me"><option value="staff">City Staff</option><option value="admin">Admin</option></select>
                    <select v-model="editingStaff.department_id" :class="inputClass" aria-label="Department"><option value="">No department (sees all)</option><option v-for="d in activeDepartments" :key="d.id" :value="d.id">{{ d.code }} — {{ d.name }}</option></select>
                    <div class="sm:col-span-4 flex gap-2 justify-end">
                      <button type="button" @click="editingStaff = null" class="px-3 py-1.5 rounded-lg border border-slate-300 text-sm">Cancel</button>
                      <button type="submit" class="px-3 py-1.5 rounded-lg bg-brand-600 text-white text-sm font-semibold">Save</button>
                    </div>
                  </form>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <form @submit.prevent="createStaff" class="bg-white rounded-2xl border border-brand-100 p-5 space-y-3 h-fit">
        <h2 class="font-bold text-ink-700">Add a staff account</h2>
        <div class="grid grid-cols-2 gap-2">
          <input v-model="newStaff.first_name" placeholder="First name" :class="inputClass" aria-label="First name" />
          <input v-model="newStaff.last_name" placeholder="Last name" :class="inputClass" aria-label="Last name" />
        </div>
        <input v-model="newStaff.email" type="email" placeholder="Work email" :class="inputClass" aria-label="Work email" />
        <select v-model="newStaff.role" :class="inputClass" aria-label="Role"><option value="staff">City Staff</option><option value="admin">Admin (full access)</option></select>
        <select v-model="newStaff.department_id" :class="inputClass" aria-label="Department" :disabled="newStaff.role === 'admin'">
          <option value="">No department (sees all permits)</option>
          <option v-for="d in activeDepartments" :key="d.id" :value="d.id">{{ d.code }} — {{ d.name }}</option>
        </select>
        <button type="submit" class="w-full py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700">Create account</button>
        <p class="text-xs text-slate-400">A temporary password is generated. They must set their own on first sign-in.</p>
      </form>
    </div>

    <!-- Departments -->
    <div v-else-if="tab === 'departments'" class="space-y-4">
      <div class="flex justify-end"><button type="button" @click="startEditDept(null)" class="px-4 py-2 rounded-xl bg-brand-600 text-white text-sm font-semibold">+ New department</button></div>
      <form v-if="editingDept" @submit.prevent="saveDept" class="bg-white rounded-2xl border-2 border-brand-300 p-5 grid sm:grid-cols-2 gap-3">
        <h2 class="sm:col-span-2 font-bold text-ink-700">{{ editingDept.id ? 'Edit department' : 'New department' }}</h2>
        <input v-model="editingDept.name" placeholder="Name, e.g. Business Permits and Licensing Office" :class="inputClass" aria-label="Name" />
        <input v-model="editingDept.code" placeholder="Code, e.g. BPLO" :class="inputClass" aria-label="Code" />
        <input v-model="editingDept.description" placeholder="Description (optional)" class="sm:col-span-2" :class="inputClass" aria-label="Description" />
        <fieldset class="sm:col-span-2">
          <legend class="text-sm font-semibold text-slate-700 mb-1">Permit types this department reviews</legend>
          <div class="flex flex-wrap gap-3">
            <label v-for="p in permitTypes" :key="p" class="flex items-center gap-2 text-sm"><input type="checkbox" :value="p" v-model="editingDept.permit_types" class="accent-[#1f7a3a]" /> {{ p }}</label>
          </div>
        </fieldset>
        <label class="flex items-center gap-2 text-sm"><input type="checkbox" v-model="editingDept.is_active" class="accent-[#1f7a3a]" /> Active</label>
        <div class="flex gap-2 justify-end">
          <button type="button" @click="editingDept = null" class="px-3 py-1.5 rounded-lg border border-slate-300 text-sm">Cancel</button>
          <button type="submit" class="px-3 py-1.5 rounded-lg bg-brand-600 text-white text-sm font-semibold">Save</button>
        </div>
      </form>
      <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div v-for="d in departments" :key="d.id" class="bg-white rounded-2xl border border-brand-100 p-5" :class="Number(d.is_active) ? '' : 'opacity-60'">
          <div class="flex items-start justify-between gap-2">
            <div>
              <div class="text-xs font-bold text-brand-700">{{ d.code }}</div>
              <div class="font-bold text-ink-700">{{ d.name }}</div>
            </div>
            <button type="button" @click="startEditDept(d)" class="text-xs font-semibold text-brand-700 hover:underline">Edit</button>
          </div>
          <p v-if="d.description" class="text-sm text-slate-500 mt-1">{{ d.description }}</p>
          <div class="flex flex-wrap gap-1 mt-3">
            <span v-for="p in d.permit_types" :key="p" class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-meadow text-slate-700 border border-brand-100">{{ p }}</span>
            <span v-if="!d.permit_types.length" class="text-xs text-slate-400">No permit types</span>
          </div>
          <div class="text-xs text-slate-400 mt-3">{{ d.staff_count }} active staff{{ Number(d.is_active) ? '' : ' · inactive' }}</div>
        </div>
      </div>
    </div>

    <!-- Public accounts -->
    <div v-else-if="tab === 'users'" class="bg-white rounded-2xl border border-brand-100 p-5 overflow-x-auto">
      <form @submit.prevent="loadUsers" class="flex flex-wrap gap-2 mb-4">
        <input v-model="userQuery" placeholder="Search name, email or mobile" class="flex-1 min-w-[12rem]" :class="inputClass" aria-label="Search accounts" />
        <select v-model="userFilter" @change="loadUsers" :class="inputClass" class="w-auto" aria-label="Filter">
          <option value="all">All</option><option value="normal">Normal Users</option><option value="residents">Residents</option><option value="business">Business Owners</option><option value="deactivated">Deactivated</option>
        </select>
        <button type="submit" class="px-4 rounded-xl bg-ink-700 text-white text-sm font-semibold">Search</button>
      </form>
      <table class="w-full text-sm">
        <thead><tr class="text-left text-xs uppercase text-slate-400"><th class="py-2 pr-3">Account</th><th class="pr-3">Labels</th><th class="pr-3">Barangay</th><th class="pr-3">Joined</th><th class="pr-3">Permits</th><th></th></tr></thead>
        <tbody>
          <tr v-for="u in users" :key="u.id" class="border-t border-slate-100 align-top" :class="Number(u.is_active) ? '' : 'opacity-60'">
            <td class="py-3 pr-3"><div class="font-semibold text-slate-800">{{ u.full_name }}</div><div class="text-xs text-slate-500">{{ u.email }}<span v-if="u.email && u.phone"> · </span>{{ u.phone }}</div>
              <span v-if="!Number(u.is_active)" class="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">Deactivated</span></td>
            <td class="py-3 pr-3"><span v-for="l in u.levels" :key="l" class="inline-block mr-1 text-[11px] font-bold px-2 py-0.5 rounded-full" :class="l === 'Normal User' ? 'bg-slate-100 text-slate-600' : 'bg-brand-100 text-brand-700'">{{ l }}</span></td>
            <td class="py-3 pr-3 text-slate-600">{{ u.barangay || '—' }}</td>
            <td class="py-3 pr-3 text-slate-500">{{ formatDate(u.created_at) }}</td>
            <td class="py-3 pr-3 text-slate-600">{{ u.applications }}</td>
            <td class="py-3 text-right whitespace-nowrap">
              <button type="button" @click="resetPassword(u)" class="text-xs font-semibold text-slate-600 hover:underline">Reset password</button>
              · <button type="button" @click="setActive(u, !Number(u.is_active))" class="text-xs font-semibold hover:underline" :class="Number(u.is_active) ? 'text-red-600' : 'text-brand-700'">{{ Number(u.is_active) ? 'Deactivate' : 'Reactivate' }}</button>
            </td>
          </tr>
          <tr v-if="!users.length"><td colspan="6" class="py-8 text-center text-slate-400">No accounts match.</td></tr>
        </tbody>
      </table>
    </div>

    <!-- Chat bot -->
    <div v-else-if="tab === 'chatbot'" class="space-y-6">
      <div class="grid grid-cols-3 gap-4">
        <div class="bg-white rounded-2xl border border-brand-100 p-5"><div class="text-xs font-semibold uppercase text-slate-500">Questions asked</div><div class="text-3xl font-bold text-ink-700">{{ faq.stats.total || 0 }}</div><div class="text-xs text-slate-400">{{ faq.stats.last_7_days || 0 }} in the last 7 days</div></div>
        <div class="bg-white rounded-2xl border border-brand-100 p-5"><div class="text-xs font-semibold uppercase text-slate-500">Answered</div><div class="text-3xl font-bold text-ink-700">{{ faq.stats.total ? Math.round(100 * faq.stats.answered / faq.stats.total) : 0 }}%</div><div class="text-xs text-slate-400">{{ faq.stats.answered || 0 }} of {{ faq.stats.total || 0 }}</div></div>
        <div class="bg-white rounded-2xl border border-brand-100 p-5"><div class="text-xs font-semibold uppercase text-slate-500">Answers</div><div class="text-3xl font-bold text-ink-700">{{ faq.faqs.filter(f => Number(f.is_active)).length }}</div><div class="text-xs text-slate-400">active FAQ entries</div></div>
      </div>

      <form v-if="editingFaq" @submit.prevent="saveFaq" class="bg-white rounded-2xl border-2 border-brand-300 p-5 grid sm:grid-cols-2 gap-3">
        <h2 class="sm:col-span-2 font-bold text-ink-700">{{ editingFaq.id ? 'Edit answer' : 'New answer' }}</h2>
        <label class="sm:col-span-2 text-sm font-semibold text-slate-700">Question <span class="font-normal text-slate-400">(shown as a suggestion)</span>
          <input v-model="editingFaq.question" :class="inputClass" class="mt-1" /></label>
        <label class="sm:col-span-2 text-sm font-semibold text-slate-700">Answer <span class="font-normal text-slate-400">(start a line with "- " for a bullet)</span>
          <textarea v-model="editingFaq.answer" rows="6" :class="inputClass" class="mt-1 font-normal"></textarea></label>
        <label class="sm:col-span-2 text-sm font-semibold text-slate-700">Tagalog question <span class="font-normal text-slate-400">(optional — shown as the suggestion chip when the visitor chose Tagalog; falls back to the English question above if left blank)</span>
          <input v-model="editingFaq.question_tl" :class="inputClass" class="mt-1" /></label>
        <label class="sm:col-span-2 text-sm font-semibold text-slate-700">Tagalog answer <span class="font-normal text-slate-400">(optional — falls back to the English answer above if left blank)</span>
          <textarea v-model="editingFaq.answer_tl" rows="6" :class="inputClass" class="mt-1 font-normal"></textarea></label>
        <label class="sm:col-span-2 text-sm font-semibold text-slate-700">Keywords <span class="font-normal text-slate-400">(words or phrases people might type, separated by commas — English and Filipino both help)</span>
          <input v-model="editingFaq.keywords" placeholder="e.g. fee, fees, how much, bayad, magkano" :class="inputClass" class="mt-1" /></label>
        <label class="text-sm font-semibold text-slate-700">Category<input v-model="editingFaq.category" :class="inputClass" class="mt-1" /></label>
        <label class="text-sm font-semibold text-slate-700">Order<input v-model.number="editingFaq.sort_order" type="number" :class="inputClass" class="mt-1" /></label>
        <label class="text-sm font-semibold text-slate-700">Link to page <span class="font-normal text-slate-400">(optional)</span><input v-model="editingFaq.link_path" placeholder="/residency" :class="inputClass" class="mt-1" /></label>
        <label class="text-sm font-semibold text-slate-700">Link text<input v-model="editingFaq.link_label" placeholder="Start resident verification" :class="inputClass" class="mt-1" /></label>
        <label class="flex items-center gap-2 text-sm"><input type="checkbox" v-model="editingFaq.is_active" class="accent-[#1f7a3a]" /> Active</label>
        <div class="flex gap-2 justify-end">
          <button type="button" @click="editingFaq = null" class="px-3 py-1.5 rounded-lg border border-slate-300 text-sm">Cancel</button>
          <button type="submit" class="px-3 py-1.5 rounded-lg bg-brand-600 text-white text-sm font-semibold">Save</button>
        </div>
      </form>

      <div class="grid lg:grid-cols-2 gap-6">
        <div class="bg-white rounded-2xl border border-brand-100 p-5">
          <h2 class="font-bold text-ink-700">Questions the bot couldn't answer</h2>
          <p class="text-sm text-slate-500 mb-3">Add an answer for the common ones, or add their words as keywords to an existing answer.</p>
          <ul class="divide-y divide-slate-100">
            <li v-for="u in faq.unanswered" :key="u.message" class="py-2.5 flex items-start justify-between gap-3">
              <div class="min-w-0"><div class="text-sm text-slate-800 break-words">“{{ u.message }}”</div><div class="text-xs text-slate-400">asked {{ u.times }}× · last {{ formatDate(u.last_asked) }}</div></div>
              <button type="button" @click="startEditFaq(null, u.message)" class="shrink-0 text-xs font-semibold text-brand-700 hover:underline">Add an answer</button>
            </li>
            <li v-if="!faq.unanswered.length" class="py-6 text-center text-sm text-slate-400">Nothing yet — every question so far had an answer.</li>
          </ul>
        </div>

        <div class="bg-white rounded-2xl border border-brand-100 p-5">
          <h2 class="font-bold text-ink-700">Try the bot</h2>
          <p class="text-sm text-slate-500 mb-3">See which answer a question gets (not logged).</p>
          <form @submit.prevent="testFaq" class="flex gap-2">
            <input v-model="testMessage" placeholder="Type a question…" :class="inputClass" aria-label="Test question" />
            <button type="submit" class="px-4 rounded-xl bg-ink-700 text-white text-sm font-semibold">Ask</button>
          </form>
          <div v-if="testReply" class="mt-3 rounded-xl bg-meadow p-3 text-sm">
            <div class="text-xs font-semibold text-slate-500 mb-1">{{ testReply.intent }} · score {{ testReply.score }}</div>
            <p class="whitespace-pre-line text-slate-700">{{ testReply.text }}</p>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-2xl border border-brand-100 p-5 overflow-x-auto">
        <div class="flex items-center justify-between mb-3">
          <h2 class="font-bold text-ink-700">Answers</h2>
          <button type="button" @click="startEditFaq(null)" class="px-4 py-2 rounded-xl bg-brand-600 text-white text-sm font-semibold">+ New answer</button>
        </div>
        <table class="w-full text-sm">
          <thead><tr class="text-left text-xs uppercase text-slate-400"><th class="py-2 pr-3">Question</th><th class="pr-3">Category</th><th class="pr-3">Used</th><th></th></tr></thead>
          <tbody>
            <tr v-for="f in faq.faqs" :key="f.id" class="border-t border-slate-100 align-top" :class="Number(f.is_active) ? '' : 'opacity-50'">
              <td class="py-2.5 pr-3"><div class="font-semibold text-slate-800">{{ f.question }}</div><div class="text-xs text-slate-400 truncate max-w-md">{{ f.keywords }}</div></td>
              <td class="py-2.5 pr-3 text-slate-600">{{ f.category }}</td>
              <td class="py-2.5 pr-3 text-slate-600">{{ f.times_used }}×</td>
              <td class="py-2.5 text-right"><button type="button" @click="startEditFaq(f)" class="text-xs font-semibold text-brand-700 hover:underline">Edit</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Audit log -->
    <div v-else-if="tab === 'audit'" class="bg-white rounded-2xl border border-brand-100 p-5 overflow-x-auto">
      <form @submit.prevent="loadAudit(1)" class="flex flex-wrap gap-2 mb-4">
        <select v-model="auditCategory" @change="loadAudit(1)" :class="inputClass" class="w-auto" aria-label="Category">
          <option value="">All activity</option><option value="residency">Resident verifications</option><option value="business">Business verifications</option><option value="admin">Admin actions (incl. chat bot edits)</option>
        </select>
        <input v-model="auditActor" placeholder="Done by (name)" class="flex-1 min-w-[10rem]" :class="inputClass" aria-label="Done by" />
        <button type="submit" class="px-4 rounded-xl bg-ink-700 text-white text-sm font-semibold">Filter</button>
      </form>
      <table class="w-full text-sm">
        <thead><tr class="text-left text-xs uppercase text-slate-400"><th class="py-2 pr-3">When</th><th class="pr-3">Who</th><th class="pr-3">What</th><th class="pr-3">About</th><th>Details</th></tr></thead>
        <tbody>
          <tr v-for="e in audit.entries" :key="e.id" class="border-t border-slate-100 align-top">
            <td class="py-2.5 pr-3 text-slate-500 whitespace-nowrap">{{ formatDate(e.created_at) }} <span class="text-xs">{{ e.created_at.slice(11, 16) }}</span></td>
            <td class="py-2.5 pr-3 text-slate-800">{{ e.actor || '—' }}</td>
            <td class="py-2.5 pr-3 font-semibold text-slate-800">{{ auditLabel(e.action) }}</td>
            <td class="py-2.5 pr-3 text-slate-600">{{ e.subject_name || (e.subject_type + ' #' + e.subject_id) }}</td>
            <td class="py-2.5 text-slate-600">{{ e.details || '' }}</td>
          </tr>
          <tr v-if="!audit.entries.length"><td colspan="5" class="py-8 text-center text-slate-400">No activity recorded yet.</td></tr>
        </tbody>
      </table>
      <div v-if="auditPages > 1" class="flex items-center justify-end gap-2 mt-4 text-sm">
        <button type="button" :disabled="audit.page <= 1" @click="loadAudit(audit.page - 1)" class="px-3 py-1.5 rounded-lg border border-slate-300 disabled:opacity-40">‹ Newer</button>
        <span class="text-slate-500">Page {{ audit.page }} of {{ auditPages }}</span>
        <button type="button" :disabled="audit.page >= auditPages" @click="loadAudit(audit.page + 1)" class="px-3 py-1.5 rounded-lg border border-slate-300 disabled:opacity-40">Older ›</button>
      </div>
    </div>
  </StaffShell>
  `,
};
