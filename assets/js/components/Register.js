import { register } from '../store/auth.js?v=118';
import { apiGet } from '../api/client.js?v=118';
import { isValidEmail, isValidPhMobile } from '../util.js?v=118';
import AuthLayout, { inputClass, labelClass, primaryButtonClass } from './AuthLayout.js?v=118';

const STEPS = ['About you', 'Contact & address', 'Password'];

function yearsAgo(years) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString().slice(0, 10);
}

export default {
  name: 'Register',
  components: { AuthLayout },
  data() {
    return {
      steps: STEPS,
      step: 0,
      form: {
        first_name: '', middle_name: '', last_name: '', birthdate: '',
        contact_method: 'email', email: '', phone: '',
        address_line: '', barangay: '', province_code: '', city_code: '', postal_code: '',
        password: '', confirm_password: '', privacy_consent: false,
      },
      showPassword: false,
      maxBirthdate: yearsAgo(18),
      minBirthdate: yearsAgo(80),
      error: '',
      loading: false,
      provinces: [],
      cities: [],
      barangays: [],      // the 75 of Dasmariñas, used only when the chosen city is this one
      homeCityCode: '',
      loadingCities: false,
      inputClass, labelClass, primaryButtonClass,
    };
  },
  computed: {
    passwordsMatch() {
      return this.form.confirm_password !== '' && this.form.password === this.form.confirm_password;
    },
    passwordMismatch() {
      return this.form.confirm_password !== '' && this.form.password !== this.form.confirm_password;
    },
    passwordStrongEnough() {
      const p = this.form.password;
      return p.length >= 8 && /[A-Z]/.test(p) && /[a-z]/.test(p) && /\d/.test(p) && /[^A-Za-z0-9]/.test(p);
    },
    // Barangay is only collected inside the city this system serves — elsewhere there is no
    // barangay office for a permit to go to.
    inHomeCity() {
      return !!this.homeCityCode && this.form.city_code === this.homeCityCode;
    },
    matchedBarangay() {
      const typed = (this.form.barangay || '').trim().toLowerCase();
      if (!typed) return null;
      return this.barangays.find((b) => b.name.toLowerCase() === typed) || null;
    },
  },
  async mounted() {
    try {
      const [loc, brgy] = await Promise.all([
        apiGet('locations.php?action=provinces'),
        apiGet('locations.php?action=barangays'),
      ]);
      this.provinces = loc.provinces;
      this.homeCityCode = loc.home.city_code;
      this.barangays = brgy.barangays;
    } catch (e) {
      // The address step will say so rather than silently offering empty lists.
      this.error = 'Could not load the address list. Please reload the page.';
    }
  },
  methods: {
    async loadCities(provinceCode) {
      if (!provinceCode) { this.cities = []; return; }
      this.loadingCities = true;
      try {
        const res = await apiGet('locations.php?action=cities&province_code=' + encodeURIComponent(provinceCode));
        this.cities = res.cities;
      } finally {
        this.loadingCities = false;
      }
    },
    async onProvinceChange() {
      this.form.city_code = '';
      this.form.barangay = '';
      await this.loadCities(this.form.province_code);
    },
    onCityChange() {
      if (!this.inHomeCity) this.form.barangay = '';
    },
    // Client-side checks per step; the server re-validates everything.
    stepError() {
      const f = this.form;
      if (this.step === 0) {
        if (!f.first_name.trim() || !f.last_name.trim()) return 'Please enter your first and last name.';
        if (!f.birthdate) return 'Please enter your date of birth.';
        if (f.birthdate > this.maxBirthdate) return 'You must be at least 18 years old to create an account.';
        if (f.birthdate < this.minBirthdate) return 'Please enter a valid date of birth (age must be 80 or below).';
      }
      if (this.step === 1) {
        if (f.contact_method === 'email' && !isValidEmail(f.email)) return 'Please enter a valid email address.';
        if (f.contact_method === 'phone' && !isValidPhMobile(f.phone)) return 'Please enter a valid mobile number, e.g. 0917 123 4567.';
        if (!f.address_line.trim()) return 'Please enter your house number and street.';
        if (!f.province_code || !f.city_code) return 'Please choose your province and city or municipality.';
        if (this.inHomeCity && !this.matchedBarangay) return 'Please choose your barangay from the list.';
        if (!/^\d{4}$/.test(f.postal_code.trim())) return 'Postal / ZIP code must be 4 digits.';
      }
      if (this.step === 2) {
        if (!this.passwordStrongEnough) return 'Password must be at least 8 characters and include an uppercase letter, a number, and a special character.';
        if (this.form.password !== this.form.confirm_password) return 'Passwords do not match.';
        if (!f.privacy_consent) return 'Please agree to the Data Privacy notice to continue.';
      }
      return '';
    },
    next() {
      this.error = this.stepError();
      if (!this.error) this.step++;
    },
    back() {
      this.error = '';
      this.step--;
    },
    async submit() {
      this.error = this.stepError();
      if (this.error) return;
      this.loading = true;
      try {
        const { confirm_password, ...payload } = this.form;
        await register(payload);
        this.$router.push('/verify');
      } catch (e) {
        this.error = e.message;
        // Send the user back to the step that holds the problem field
        if (/email|mobile/i.test(e.message)) this.step = 1;
        else if (/name|birth|18/i.test(e.message)) this.step = 0;
        else if (/postal|address|barangay|city|province|municipalit/i.test(e.message)) this.step = 1;
      } finally {
        this.loading = false;
      }
    },
  },
  template: `
  <AuthLayout :loading="loading" loading-kind="register" eyebrow="Create your account" headline="Start with a free account — browse permits and track everything in one place.">
    <h1 class="text-3xl font-bold tracking-tight text-slate-900 mb-3">Create an account</h1>

    <div class="mb-5" aria-live="polite">
      <div class="flex items-center justify-between text-xs font-semibold mb-1.5">
        <span class="text-[#1f7a3a]">Step {{ step + 1 }} of {{ steps.length }} · {{ steps[step] }}</span>
      </div>
      <div class="grid grid-cols-3 gap-1.5">
        <div v-for="(s, i) in steps" :key="s" class="h-1.5 rounded-full transition-colors" :class="i <= step ? 'bg-[#1f7a3a]' : 'bg-slate-200'"></div>
      </div>
    </div>

    <form @submit.prevent="step < steps.length - 1 ? next() : submit()" class="space-y-3.5" novalidate>
      <!-- Step 1: About you -->
      <template v-if="step === 0">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label :class="labelClass" for="r-first">First name</label>
            <input id="r-first" v-model="form.first_name" type="text" autocomplete="given-name" placeholder="Juan" :class="inputClass" />
          </div>
          <div>
            <label :class="labelClass" for="r-middle">Middle name <span class="text-slate-400 font-normal text-xs">(optional)</span></label>
            <input id="r-middle" v-model="form.middle_name" type="text" autocomplete="additional-name" placeholder="Santos" :class="inputClass" />
          </div>
        </div>
        <div>
          <label :class="labelClass" for="r-last">Last name</label>
          <input id="r-last" v-model="form.last_name" type="text" autocomplete="family-name" placeholder="Dela Cruz" :class="inputClass" />
        </div>
        <div>
          <label :class="labelClass" for="r-dob">Date of birth</label>
          <input id="r-dob" v-model="form.birthdate" type="date" :min="minBirthdate" :max="maxBirthdate" autocomplete="bday" :class="inputClass" />
          <p class="text-xs text-slate-400 mt-1.5">You must be between 18 and 80 years old.</p>
        </div>
      </template>

      <!-- Step 2: Contact & address -->
      <template v-if="step === 1">
        <div>
          <div class="flex items-center justify-between mb-1.5">
            <label class="text-[15px] font-medium text-slate-900" :for="form.contact_method === 'email' ? 'r-email' : 'r-phone'">
              {{ form.contact_method === 'email' ? 'Email' : 'Mobile number' }}
            </label>
            <div class="flex rounded-full bg-[#f3f9e3] p-0.5 text-xs font-semibold" role="radiogroup" aria-label="Sign up with">
              <button type="button" role="radio" :aria-checked="form.contact_method === 'email'" @click="form.contact_method = 'email'"
                class="px-3 py-1 rounded-full transition" :class="form.contact_method === 'email' ? 'bg-white shadow text-[#1f7a3a]' : 'text-slate-500'">Email</button>
              <button type="button" role="radio" :aria-checked="form.contact_method === 'phone'" @click="form.contact_method = 'phone'"
                class="px-3 py-1 rounded-full transition" :class="form.contact_method === 'phone' ? 'bg-white shadow text-[#1f7a3a]' : 'text-slate-500'">Mobile</button>
            </div>
          </div>
          <input v-if="form.contact_method === 'email'" id="r-email" v-model="form.email" type="email" autocomplete="email" placeholder="you@email.com" :class="inputClass" />
          <input v-else id="r-phone" v-model="form.phone" type="tel" autocomplete="tel" placeholder="0917 123 4567" :class="inputClass" />
        </div>
        <div>
          <label :class="labelClass" for="r-street">House no. / Street</label>
          <input id="r-street" v-model="form.address_line" type="text" autocomplete="address-line1" placeholder="Blk 4 Lot 18, Narra Drive" :class="inputClass" />
        </div>
        <!-- Province and city come from the PSGC list rather than being typed: whether an account is
             in Dasmariñas decides what it can file, so it cannot rest on spelling. -->
        <div>
          <label :class="labelClass" for="r-prov">Province</label>
          <select id="r-prov" v-model="form.province_code" @change="onProvinceChange" :class="inputClass">
            <option value="">Choose a province…</option>
            <option v-for="pr in provinces" :key="pr.code" :value="pr.code">{{ pr.name }}</option>
          </select>
        </div>
        <div class="grid grid-cols-[1fr_7rem] gap-3">
          <div>
            <label :class="labelClass" for="r-city">City / Municipality</label>
            <select id="r-city" v-model="form.city_code" @change="onCityChange" :disabled="!form.province_code || loadingCities" :class="inputClass">
              <option value="">{{ loadingCities ? 'Loading…' : (form.province_code ? 'Choose…' : 'Province first') }}</option>
              <option v-for="c in cities" :key="c.code" :value="c.code">{{ c.name }}</option>
            </select>
          </div>
          <div>
            <label :class="labelClass" for="r-zip">Postal code</label>
            <input id="r-zip" v-model="form.postal_code" type="text" inputmode="numeric" maxlength="4" autocomplete="postal-code" placeholder="1870" :class="inputClass" />
          </div>
        </div>

        <!-- Only for Dasmariñas: this is the link that routes a permit to a barangay secretariat. -->
        <div v-if="inHomeCity">
          <label :class="labelClass" for="r-brgy">Barangay</label>
          <input id="r-brgy" v-model="form.barangay" list="r-brgy-list" type="text" autocomplete="off"
            placeholder="Start typing to search…"
            :class="[inputClass, form.barangay && !matchedBarangay ? '!border-red-300' : '']" />
          <datalist id="r-brgy-list">
            <option v-for="b in barangays" :key="b.id" :value="b.name" />
          </datalist>
          <p v-if="form.barangay && !matchedBarangay" class="text-xs text-red-600 mt-1">
            Not one of the {{ barangays.length }} barangays of Dasmariñas.
          </p>
        </div>
        <p v-else-if="form.city_code" class="text-xs text-slate-500 leading-relaxed">
          You can create an account and browse permits from anywhere. Filing them needs a verified
          address in Dasmariñas, which you can apply for later from your profile.
        </p>
      </template>

      <!-- Step 3: Password & consent -->
      <template v-if="step === 2">
        <div>
          <label :class="labelClass" for="r-pw">Password</label>
          <div class="relative">
            <input id="r-pw" v-model="form.password" :type="showPassword ? 'text' : 'password'" autocomplete="new-password" placeholder="••••••••••" :class="inputClass + ' pr-11'" />
            <button type="button" @click="showPassword = !showPassword" :aria-label="showPassword ? 'Hide password' : 'Show password'"
              class="absolute inset-y-0 right-0 flex items-center px-4 rounded-r-xl text-slate-500 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1f7a3a]/40">
              <svg v-if="!showPassword" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>
              <svg v-else class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a18.6 18.6 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 7 11 7a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><path d="M1 1l22 22"/></svg>
            </button>
          </div>
          <p class="text-xs mt-1.5" :class="form.password && !passwordStrongEnough ? 'text-sun-700' : 'text-slate-400'">At least 8 characters, with an uppercase letter, a number, and a special character.</p>
        </div>
        <div>
          <label :class="labelClass" for="r-pw2">Confirm password</label>
          <input id="r-pw2" v-model="form.confirm_password" :type="showPassword ? 'text' : 'password'" autocomplete="new-password" placeholder="••••••••••"
            :aria-invalid="passwordMismatch" :class="inputClass" :style="passwordMismatch ? 'border-color:#f87171' : ''" />
          <p class="h-5 mt-1.5 text-xs font-medium" aria-live="polite" :class="passwordMismatch ? 'text-red-600' : 'text-[#1f7a3a]'">
            {{ passwordMismatch ? '✕ Passwords don\\'t match' : passwordsMatch ? '✓ Passwords match' : '' }}
          </p>
        </div>
        <label class="flex items-start gap-3 rounded-xl bg-[#f3f9e3] p-3 cursor-pointer">
          <input v-model="form.privacy_consent" type="checkbox" class="mt-0.5 w-4 h-4 accent-[#1f7a3a] shrink-0" />
          <span class="text-xs text-slate-600 leading-relaxed">
            I agree that the city may collect and process my personal information to create my account and handle my permit applications, in line with the <strong>Data Privacy Act of 2012 (RA 10173)</strong>.
          </span>
        </label>
      </template>

      <p v-if="error" class="text-sm text-red-600" role="alert">{{ error }}</p>

      <div class="flex gap-3 pt-1">
        <button v-if="step > 0" type="button" @click="back"
          class="px-5 py-3 rounded-xl border border-slate-300 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition">Back</button>
        <button type="submit" :disabled="loading" :class="primaryButtonClass">
          {{ loading ? 'Creating account…' : step < steps.length - 1 ? 'Continue' : 'Create account' }}
        </button>
      </div>
    </form>

    <p class="text-sm text-slate-500 mt-5 text-center">
      Already have an account?
      <router-link to="/login" class="text-[#1f7a3a] font-semibold hover:underline">Log in</router-link>
    </p>
  </AuthLayout>
  `,
};
