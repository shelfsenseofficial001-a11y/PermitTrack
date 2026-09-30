import { apiPost } from '../api/client.js?v=71';
import AppShell from './AppShell.js?v=71';
import { inputClass } from './AuthLayout.js?v=71';
import { authState, loadCurrentUser } from '../store/auth.js?v=71';
import { formatDate, timeAgo } from '../util.js?v=71';
import { openChangePassword } from '../store/ui.js?v=71';

const FIELDS = ['first_name', 'middle_name', 'last_name', 'birthdate', 'address_line', 'barangay', 'city', 'postal_code'];

// What counts toward "profile complete" — the details a permit application draws on
const REQUIRED = ['first_name', 'last_name', 'birthdate', 'address_line', 'barangay', 'city', 'postal_code'];

export default {
  name: 'Profile',
  components: { AppShell },
  data() {
    return {
      form: {},
      editing: false,
      saving: false,
      error: '',
      toast: '',
      inputClass,
    };
  },
  computed: {
    user() {
      return authState.user || {};
    },
    initials() {
      const name = this.user.full_name || '';
      return name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
    },
    levels() {
      return this.user.levels || [];
    },
    isApplicant() {
      return this.user.role === 'applicant';
    },
    completeness() {
      const filled = REQUIRED.filter((f) => this.user[f]).length
        + (this.user.email_verified_at || this.user.phone_verified_at ? 1 : 0);
      return Math.round((filled / (REQUIRED.length + 1)) * 100);
    },
    // Read-only view of personal details; empty ones render as "Not provided"
    details() {
      const u = this.user;
      return [
        { label: 'First name', value: u.first_name },
        { label: 'Middle name', value: u.middle_name, optional: true },
        { label: 'Last name', value: u.last_name },
        { label: 'Date of birth', value: u.birthdate ? formatDate(u.birthdate) : '' },
        { label: 'House / street', value: u.address_line, wide: true },
        { label: 'Barangay', value: u.barangay },
        { label: 'City', value: u.city },
        { label: 'Postal code', value: u.postal_code },
      ];
    },
    residency() {
      return {
        none: { label: 'Not verified', tone: 'slate', note: 'Verify your residency to apply for resident permits.', cta: 'Verify residency' },
        pending: { label: 'Under review', tone: 'sun', note: 'City Staff is checking your proofs of residence. We will notify you when it is done.', cta: 'View submission' },
        verified: { label: 'Verified', tone: 'brand', note: 'You can apply for every resident permit.', cta: '' },
        rejected: { label: 'Needs changes', tone: 'red', note: 'Your last submission was not approved. Upload new proofs to try again.', cta: 'Upload new proofs' },
      }[this.user.resident_status || 'none'];
    },
  },
  async mounted() {
    if (!authState.user) await loadCurrentUser();
    this.resetForm();
  },
  beforeUnmount() {
    clearTimeout(this.toastTimer);
  },
  methods: {
    formatDate,
    timeAgo,
    openChangePassword,
    toneClass(tone) {
      return {
        slate: 'bg-slate-100 text-slate-600 ring-slate-200',
        sun: 'bg-sun-50 text-sun-700 ring-sun-200',
        brand: 'bg-brand-50 text-brand-700 ring-brand-200',
        red: 'bg-red-50 text-red-700 ring-red-200',
      }[tone];
    },
    resetForm() {
      this.form = FIELDS.reduce((acc, f) => ({ ...acc, [f]: this.user[f] || '' }), {});
    },
    startEdit() {
      this.resetForm();
      this.error = '';
      this.editing = true;
      this.$nextTick(() => {
        const el = this.$refs.details;
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        const first = this.$refs.firstField;
        if (first) first.focus({ preventScroll: true });
      });
    },
    cancel() {
      this.editing = false;
      this.error = '';
      this.resetForm();
    },
    async save() {
      this.error = '';
      this.saving = true;
      try {
        const { user } = await apiPost('account.php?action=update_profile', this.form);
        authState.user = user;
        this.editing = false;
        this.showToast('Profile updated');
      } catch (e) {
        this.error = e.message;
      } finally {
        this.saving = false;
      }
    },
    showToast(message) {
      this.toast = message;
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => { this.toast = ''; }, 2800);
    },
  },
  template: `
  <AppShell>
    <!-- Cover + identity -->
    <div class="relative overflow-hidden rounded-3xl bg-white border border-brand-100 shadow-[0_20px_50px_-30px_rgba(16,48,29,0.45)]">
      <div class="pt-gradient-wide h-28 sm:h-36"></div>
      <div class="px-6 sm:px-8 pb-6 flex flex-wrap items-end gap-x-5 gap-y-4">
        <div class="-mt-12 sm:-mt-14 w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-ink-700 text-sun-300 ring-[5px] ring-white shadow-xl flex items-center justify-center text-3xl sm:text-4xl font-bold tracking-tight shrink-0">
          {{ initials }}
        </div>
        <div class="min-w-0 flex-1 pt-3">
          <h1 class="text-2xl sm:text-[1.75rem] font-bold tracking-tight text-ink-700 truncate">{{ user.full_name }}</h1>
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm text-slate-500">
            <span class="truncate">{{ user.email || user.phone }}</span>
            <span class="w-1 h-1 rounded-full bg-slate-300" aria-hidden="true"></span>
            <span>Member since {{ formatDate(user.created_at) }}</span>
          </div>
          <div class="flex flex-wrap gap-1.5 mt-3">
            <span v-for="level in levels" :key="level"
              class="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full ring-1 ring-inset"
              :class="level === 'Normal User' ? 'bg-slate-50 text-slate-600 ring-slate-200' : 'bg-brand-50 text-brand-700 ring-brand-200'">
              <svg v-if="level !== 'Normal User'" class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
              {{ level }}
            </span>
          </div>
        </div>

        <!-- Completeness, only while there is something left to fill in -->
        <div v-if="completeness < 100" class="w-full sm:w-56 rounded-2xl bg-meadow border border-brand-100 px-4 py-3">
          <div class="flex items-baseline justify-between">
            <span class="text-xs font-semibold text-slate-600">Profile completeness</span>
            <span class="text-sm font-bold text-ink-700">{{ completeness }}%</span>
          </div>
          <div class="h-1.5 rounded-full bg-brand-100 mt-2 overflow-hidden">
            <div class="h-full rounded-full bg-brand-600 transition-all duration-500" :style="{ width: completeness + '%' }"></div>
          </div>
          <button type="button" @click="startEdit" class="text-xs font-semibold text-brand-700 hover:underline mt-2">Complete your profile →</button>
        </div>
      </div>
    </div>

    <!-- Settings sections: a label column beside each card -->
    <div class="mt-2 divide-y divide-brand-100">

      <section ref="details" class="grid lg:grid-cols-[15rem_1fr] gap-4 lg:gap-10 py-8 scroll-mt-24">
        <div>
          <h2 class="text-base font-semibold text-ink-700">Personal details</h2>
          <p class="text-sm text-slate-500 mt-1 leading-relaxed">Used to pre-fill your permit applications. Keep it matching your government ID.</p>
        </div>

        <div class="bg-white rounded-2xl border border-brand-100 shadow-sm">
          <!-- View -->
          <!-- cross-fade between reading and editing, one leaving before the other arrives -->
          <transition name="swap" mode="out-in">
          <div v-if="!editing" key="view">
            <dl class="grid sm:grid-cols-3 gap-x-6 gap-y-5 p-6">
              <div v-for="d in details" :key="d.label" :class="d.wide ? 'sm:col-span-3' : ''">
                <dt class="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{{ d.label }}</dt>
                <dd class="mt-1 text-sm" :class="d.value ? 'font-medium text-slate-800' : 'text-slate-400'">
                  {{ d.value || (d.optional ? '—' : 'Not provided') }}
                </dd>
              </div>
            </dl>
            <div class="flex items-center justify-end gap-3 px-6 py-3.5 border-t border-brand-100 bg-slate-50/60 rounded-b-2xl">
              <button type="button" @click="startEdit"
                class="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-700 bg-white border border-slate-300 hover:border-slate-400 hover:bg-slate-50 px-4 py-2 rounded-xl transition">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                Edit details
              </button>
            </div>
          </div>
          <form v-else key="edit" @submit.prevent="save" novalidate>
            <div class="p-6 space-y-4">
              <div class="grid sm:grid-cols-3 gap-4">
                <div>
                  <label class="block text-xs font-semibold text-slate-600 mb-1.5" for="p-first">First name</label>
                  <input id="p-first" ref="firstField" v-model="form.first_name" required autocomplete="given-name" :class="inputClass" />
                </div>
                <div>
                  <label class="block text-xs font-semibold text-slate-600 mb-1.5" for="p-middle">Middle name <span class="font-normal text-slate-400">(optional)</span></label>
                  <input id="p-middle" v-model="form.middle_name" autocomplete="additional-name" :class="inputClass" />
                </div>
                <div>
                  <label class="block text-xs font-semibold text-slate-600 mb-1.5" for="p-last">Last name</label>
                  <input id="p-last" v-model="form.last_name" required autocomplete="family-name" :class="inputClass" />
                </div>
              </div>
              <div class="sm:w-1/3 sm:pr-3">
                <label class="block text-xs font-semibold text-slate-600 mb-1.5" for="p-dob">Date of birth</label>
                <input id="p-dob" v-model="form.birthdate" type="date" required autocomplete="bday" :class="inputClass" />
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1.5" for="p-addr">House / street</label>
                <input id="p-addr" v-model="form.address_line" required autocomplete="address-line1" placeholder="e.g. 12 Mabini St., Unit B" :class="inputClass" />
              </div>
              <div class="grid sm:grid-cols-3 gap-4">
                <div>
                  <label class="block text-xs font-semibold text-slate-600 mb-1.5" for="p-brgy">Barangay</label>
                  <input id="p-brgy" v-model="form.barangay" required :class="inputClass" />
                </div>
                <div>
                  <label class="block text-xs font-semibold text-slate-600 mb-1.5" for="p-city">City</label>
                  <input id="p-city" v-model="form.city" required autocomplete="address-level2" :class="inputClass" />
                </div>
                <div>
                  <label class="block text-xs font-semibold text-slate-600 mb-1.5" for="p-zip">Postal code</label>
                  <input id="p-zip" v-model="form.postal_code" required inputmode="numeric" maxlength="4" autocomplete="postal-code" placeholder="4 digits" :class="inputClass" />
                </div>
              </div>

              <div v-if="error" class="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5" role="alert">
                <svg class="w-4 h-4 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
                {{ error }}
              </div>
            </div>
            <div class="flex items-center justify-end gap-2 px-6 py-3.5 border-t border-brand-100 bg-slate-50/60 rounded-b-2xl">
              <button type="button" @click="cancel" class="text-sm font-semibold text-slate-600 px-4 py-2 rounded-xl hover:bg-slate-100 transition">Cancel</button>
              <button type="submit" :disabled="saving"
                class="text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-60 px-5 py-2 rounded-xl transition shadow-[0_8px_18px_-8px_rgba(31,122,58,0.6)]">
                {{ saving ? 'Saving…' : 'Save changes' }}
              </button>
            </div>
          </form>
          </transition>
        </div>
      </section>

      <section class="grid lg:grid-cols-[15rem_1fr] gap-4 lg:gap-10 py-8">
        <div>
          <h2 class="text-base font-semibold text-ink-700">Contact</h2>
          <p class="text-sm text-slate-500 mt-1 leading-relaxed">Where permit updates are sent. Changing either one sends a code to confirm it first.</p>
        </div>
        <div class="bg-white rounded-2xl border border-brand-100 shadow-sm divide-y divide-brand-100">
          <div v-for="c in [
              { key: 'email', label: 'Email address', value: user.email, verified: user.email_verified_at },
              { key: 'phone', label: 'Mobile number', value: user.phone, verified: user.phone_verified_at },
            ]" :key="c.key" class="flex items-center gap-4 px-6 py-4">
            <span class="w-10 h-10 rounded-xl bg-meadow text-brand-700 flex items-center justify-center shrink-0">
              <svg v-if="c.key === 'email'" class="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>
              <svg v-else class="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18h2"/></svg>
            </span>
            <div class="min-w-0 flex-1">
              <div class="text-xs text-slate-400">{{ c.label }}</div>
              <div class="text-sm truncate" :class="c.value ? 'font-medium text-slate-800' : 'text-slate-400'">{{ c.value || 'Not added' }}</div>
            </div>
            <span v-if="c.value" class="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full ring-1 ring-inset shrink-0"
              :class="c.verified ? 'bg-brand-50 text-brand-700 ring-brand-200' : 'bg-sun-50 text-sun-700 ring-sun-200'">
              <svg v-if="c.verified" class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
              {{ c.verified ? 'Verified' : 'Unverified' }}
            </span>
          </div>
        </div>
      </section>

      <section v-if="isApplicant" class="grid lg:grid-cols-[15rem_1fr] gap-4 lg:gap-10 py-8">
        <div>
          <h2 class="text-base font-semibold text-ink-700">Residency</h2>
          <p class="text-sm text-slate-500 mt-1 leading-relaxed">Verified residents can apply for every resident permit in the city.</p>
        </div>
        <div class="bg-white rounded-2xl border border-brand-100 shadow-sm p-6 flex flex-wrap items-center gap-4">
          <span class="w-10 h-10 rounded-xl bg-meadow text-brand-700 flex items-center justify-center shrink-0">
            <svg class="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>
          </span>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-sm font-semibold text-slate-800">Residency status</span>
              <span class="text-[11px] font-semibold px-2.5 py-1 rounded-full ring-1 ring-inset" :class="toneClass(residency.tone)">{{ residency.label }}</span>
            </div>
            <p class="text-sm text-slate-500 mt-1">{{ residency.note }}</p>
          </div>
          <router-link v-if="residency.cta" to="/residency"
            class="text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 px-4 py-2 rounded-xl transition shrink-0">
            {{ residency.cta }}
          </router-link>
        </div>
      </section>

      <section class="grid lg:grid-cols-[15rem_1fr] gap-4 lg:gap-10 py-8">
        <div>
          <h2 class="text-base font-semibold text-ink-700">Security</h2>
          <p class="text-sm text-slate-500 mt-1 leading-relaxed">Keep your account protected with a strong, unique password.</p>
        </div>
        <div class="bg-white rounded-2xl border border-brand-100 shadow-sm divide-y divide-brand-100">
          <div class="flex items-center gap-4 px-6 py-4">
            <span class="w-10 h-10 rounded-xl bg-meadow text-brand-700 flex items-center justify-center shrink-0">
              <svg class="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </span>
            <div class="min-w-0 flex-1">
              <div class="text-sm font-semibold text-slate-800">Password</div>
              <div class="text-xs text-slate-400 mt-0.5 tracking-widest">••••••••••</div>
            </div>
            <button type="button" @click="openChangePassword"
              class="text-sm font-semibold text-ink-700 bg-white border border-slate-300 hover:border-slate-400 hover:bg-slate-50 px-4 py-2 rounded-xl transition shrink-0">
              Change
            </button>
          </div>
          <div class="flex items-center gap-4 px-6 py-4">
            <span class="w-10 h-10 rounded-xl bg-meadow text-brand-700 flex items-center justify-center shrink-0">
              <svg class="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
            </span>
            <div class="min-w-0 flex-1">
              <div class="text-sm font-semibold text-slate-800">Last sign-in</div>
              <div class="text-xs text-slate-500 mt-0.5">{{ user.last_login_at ? timeAgo(user.last_login_at) + ' · ' + formatDate(user.last_login_at) : 'No sign-ins recorded yet' }}</div>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- Save confirmation -->
    <transition enter-from-class="opacity-0 translate-y-2" enter-active-class="transition duration-200" leave-to-class="opacity-0 translate-y-2" leave-active-class="transition duration-200">
      <div v-if="toast" role="status"
        class="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 inline-flex items-center gap-2 bg-ink-700 text-white text-sm font-semibold pl-3 pr-4 py-2.5 rounded-full shadow-[0_16px_40px_-12px_rgba(0,0,0,0.5)]">
        <span class="w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center">
          <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
        </span>
        {{ toast }}
      </div>
    </transition>
  </AppShell>
  `,
};
