import { register, googleSignupProfile, googleRegister, googleCancel, homePathFor } from '../store/auth.js?v=129';
import { apiGet } from '../api/client.js?v=129';
import AuthLayout, { inputClass, labelClass, primaryButtonClass } from './AuthLayout.js?v=129';
import SelectMenu from './SelectMenu.js?v=129';
import GoogleButton from './GoogleButton.js?v=129';

const STEPS = ['About you', 'Contact & address', 'Password'];
// Signing up with Google: the email is Google's (already verified) and there is no password
const GOOGLE_STEPS = ['About you', 'Address', 'Confirm'];

function yearsAgo(years) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString().slice(0, 10);
}

export default {
  name: 'Register',
  components: { AuthLayout, GoogleButton, SelectMenu },
  data() {
    return {
      step: 0,
      google: null, // { email, first_name, last_name } while finishing a Google sign-up
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
      // Live "is this email/mobile already registered" check, debounced as the applicant types
      contactCheck: { checking: false, taken: false, checkedValue: '' },
      contactCheckTimer: null,
      inputClass, labelClass, primaryButtonClass,
    };
  },
  computed: {
    contactValue() {
      return this.form.contact_method === 'email' ? this.form.email.trim() : this.form.phone.trim();
    },
    contactFormatValid() {
      return this.form.contact_method === 'email'
        ? /^\S+@\S+\.\S+$/.test(this.form.email.trim())
        : /^(\+?63|0)?9\d{9}$/.test(this.form.phone.replace(/[\s-]/g, ''));
    },
    contactTaken() {
      return this.contactCheck.taken && this.contactCheck.checkedValue === this.contactValue;
    },
    steps() {
      return this.google ? GOOGLE_STEPS : STEPS;
    },
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
  watch: {
    // The Google button on this page lands back here with ?google=1
    '$route.query.google'(value) {
      if (value) this.loadGoogleSignup();
    },
  },
  async mounted() {
    if (this.$route.query.google) this.loadGoogleSignup();
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
    async loadGoogleSignup() {
      let profile = null;
      try {
        profile = await googleSignupProfile();
      } catch (e) {
        profile = null;
      }
      if (!profile) {
        // Expired or never started: carry on with the normal sign-up
        this.google = null;
        if (this.$route.query.google) this.$router.replace('/register');
        return;
      }
      this.google = profile;
      this.step = 0;
      this.error = '';
      this.form.contact_method = 'email';
      this.form.email = profile.email;
      this.form.first_name ||= profile.first_name;
      this.form.last_name ||= profile.last_name;
    },
    async leaveGoogleSignup() {
      try { await googleCancel(); } catch (e) { /* the session forgets it on its own */ }
      this.google = null;
      this.step = 0;
      this.error = '';
      this.form.email = '';
      this.$router.replace('/register');
    },
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
    // Waits for a pause in typing, and only asks once the value looks like a real email/number
    scheduleContactCheck() {
      clearTimeout(this.contactCheckTimer);
      this.contactCheck.taken = false;
      this.contactCheck.checking = this.contactFormatValid;
      if (!this.contactFormatValid) return;
      this.contactCheckTimer = setTimeout(() => this.checkContactAvailability(), 500);
    },
    async checkContactAvailability() {
      const value = this.contactValue;
      const params = this.form.contact_method === 'email' ? { email: value } : { phone: value };
      try {
        const res = await apiGet('auth.php?action=check_contact&' + new URLSearchParams(params));
        if (this.contactValue !== value) return; // typed on while the request was in flight
        this.contactCheck.taken = res.available === false;
        this.contactCheck.checkedValue = value;
      } catch (e) {
        // Stay quiet: the final submit re-checks this server-side
      } finally {
        if (this.contactValue === value) this.contactCheck.checking = false;
      }
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
        if (f.contact_method === 'email' && !/^\S+@\S+\.\S+$/.test(f.email.trim())) return 'Please enter a valid email address.';
        if (f.contact_method === 'phone' && !/^(\+?63|0)?9\d{9}$/.test(f.phone.replace(/[\s-]/g, ''))) return 'Please enter a valid mobile number, e.g. 0917 123 4567.';
        if (this.contactTaken) {
          return f.contact_method === 'email'
            ? 'An account with that email already exists. Please log in instead.'
            : 'An account with that mobile number already exists. Please log in instead.';
        }
        if (!f.address_line.trim()) return 'Please enter your house number and street.';
        if (!f.province_code || !f.city_code) return 'Please choose your province and city or municipality.';
        if (this.inHomeCity && !this.matchedBarangay) return 'Please choose your barangay from the list.';
        if (!/^\d{4}$/.test(f.postal_code.trim())) return 'Postal / ZIP code must be 4 digits.';
      }
      if (this.step === 2 && this.google) {
        if (!f.privacy_consent) return 'Please agree to the Data Privacy notice to continue.';
      } else if (this.step === 2) {
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
        if (this.google) {
          // Google already verified the email, so there is no code to enter
          const { password, contact_method, email, phone, ...profile } = payload;
          const user = await googleRegister(profile);
          this.$router.push(homePathFor(user));
          return;
        }
        await register(payload);
        this.$router.push('/verify');
      } catch (e) {
        this.error = e.message;
        if (this.google && e.status === 401) {
          this.google = null;
          this.$router.replace('/register');
          return;
        }
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
    <p v-if="google" class="text-sm text-slate-500 leading-relaxed -mt-1 mb-4">
      A few more details to finish signing up with Google as <strong class="text-slate-700">{{ google.email }}</strong>.
      <button type="button" @click="leaveGoogleSignup" class="text-[#1f7a3a] font-semibold hover:underline">Use email or mobile instead</button>
    </p>

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
        <div v-if="google">
          <span :class="labelClass">Email</span>
          <div class="flex items-center gap-2 rounded-xl bg-[#f3f9e3] px-4 py-3 text-sm text-slate-700">
            <svg class="w-4 h-4 shrink-0 text-[#1f7a3a]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
            <span class="truncate">{{ google.email }}</span>
            <span class="ml-auto text-xs text-slate-500 shrink-0">Verified by Google</span>
          </div>
        </div>
        <div v-else>
          <div class="flex items-center justify-between mb-1.5">
            <label class="text-[15px] font-medium text-slate-900" :for="form.contact_method === 'email' ? 'r-email' : 'r-phone'">
              {{ form.contact_method === 'email' ? 'Email' : 'Mobile number' }}
            </label>
            <div class="flex rounded-full bg-[#f3f9e3] p-0.5 text-xs font-semibold" role="radiogroup" aria-label="Sign up with">
              <button type="button" role="radio" :aria-checked="form.contact_method === 'email'" @click="form.contact_method = 'email'; scheduleContactCheck()"
                class="px-3 py-1 rounded-full transition" :class="form.contact_method === 'email' ? 'bg-white shadow text-[#1f7a3a]' : 'text-slate-500'">Email</button>
              <button type="button" role="radio" :aria-checked="form.contact_method === 'phone'" @click="form.contact_method = 'phone'; scheduleContactCheck()"
                class="px-3 py-1 rounded-full transition" :class="form.contact_method === 'phone' ? 'bg-white shadow text-[#1f7a3a]' : 'text-slate-500'">Mobile</button>
            </div>
          </div>
          <input v-if="form.contact_method === 'email'" id="r-email" v-model="form.email" @input="scheduleContactCheck" type="email" autocomplete="email"
            placeholder="you@email.com" :class="[inputClass, (form.email && !contactFormatValid) || contactTaken ? '!border-red-300' : '']" />
          <input v-else id="r-phone" v-model="form.phone" @input="scheduleContactCheck" type="tel" autocomplete="tel"
            placeholder="0917 123 4567" :class="[inputClass, (form.phone && !contactFormatValid) || contactTaken ? '!border-red-300' : '']" />
          <p v-if="contactValue && !contactFormatValid" class="text-xs text-red-600 mt-1.5">
            {{ form.contact_method === 'email' ? 'Please enter a valid email address.' : 'Please enter a valid mobile number, e.g. 0917 123 4567.' }}
          </p>
          <p v-else-if="contactCheck.checking" class="text-xs text-slate-400 mt-1.5">Checking…</p>
          <p v-else-if="contactTaken" class="text-xs text-red-600 mt-1.5">
            An account with that {{ form.contact_method === 'email' ? 'email' : 'mobile number' }} already exists.
            <router-link to="/login" class="underline font-semibold">Log in instead</router-link>.
          </p>
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
          <label id="r-brgy-label" :class="labelClass" for="r-brgy">Barangay</label>
          <SelectMenu id="r-brgy" :labelledby="'r-brgy-label'" v-model="form.barangay" placeholder="Choose a barangay…"
            :options="barangays.map((b) => ({ value: b.name, label: b.name }))" />
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
      <template v-if="step === 2 && google">
        <p class="text-sm text-slate-600 leading-relaxed">
          You'll sign in with your Google account, so there's no password to set. You can add one later from
          Change password if you'd also like to sign in with your email.
        </p>
      </template>
      <template v-if="step === 2 && !google">
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
      </template>
      <template v-if="step === 2">
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

    <GoogleButton v-if="!google && step === 0" text="signup_with" divider="or sign up with" @busy="loading = $event" />

    <p class="text-sm text-slate-500 mt-5 text-center">
      Already have an account?
      <router-link to="/login" class="text-[#1f7a3a] font-semibold hover:underline">Log in</router-link>
    </p>
  </AuthLayout>
  `,
};
