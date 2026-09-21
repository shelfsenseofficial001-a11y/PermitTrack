import { login, register } from '../store/auth.js';

export default {
  name: 'Login',
  data() {
    return {
      persona: 'applicant', // 'applicant' | 'staff'
      mode: 'login', // 'login' | 'signup'
      accountType: 'resident',
      form: { full_name: '', email: '', password: '' },
      showPassword: false,
      error: '',
      loading: false,
    };
  },
  methods: {
    async submit() {
      this.error = '';
      this.loading = true;
      try {
        if (this.mode === 'login') {
          const user = await login(this.form.email, this.form.password, this.persona === 'staff');
          this.afterAuth(user);
        } else {
          const user = await register({
            full_name: this.form.full_name,
            email: this.form.email,
            password: this.form.password,
            account_type: this.accountType,
            role: 'applicant',
          });
          this.afterAuth(user);
        }
      } catch (e) {
        this.error = e.message;
      } finally {
        this.loading = false;
      }
    },
    afterAuth(user) {
      if (user.role === 'staff') {
        this.$router.push('/reviewer');
      } else if (!user.onboarding_completed) {
        this.$router.push('/onboarding');
      } else {
        this.$router.push('/dashboard');
      }
    },
  },
  template: `
  <div class="min-h-screen grid lg:grid-cols-2">
    <div class="hidden lg:flex flex-col justify-between bg-ink-700 text-white p-12">
      <div>
        <div class="flex items-center gap-3 mb-10">
          <div class="w-9 h-9 rounded-lg bg-brand-500 flex items-center justify-center font-bold text-sm">PT</div>
          <span class="text-lg font-bold">PermitTrack</span>
        </div>
        <p class="text-3xl font-bold leading-tight max-w-md">Track your permit like a package — see exactly where it stands.</p>
        <p class="mt-5 text-ink-200 max-w-md text-sm leading-relaxed">Submit applications, upload documents, and follow every inspection from Submitted to Issued — no more guessing where things stand.</p>

        <div class="flex items-center gap-3 mt-8">
          <div class="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
          </div>
          <div class="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <div class="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 9h1m4 0h1M9 13h1m4 0h1M9 17h1m4 0h1"/></svg>
          </div>
        </div>
      </div>
      <p class="text-ink-300 text-sm">Serving residents and businesses across the city.</p>
    </div>

    <div class="flex items-center justify-center p-8 bg-slate-50">
      <div class="w-full max-w-sm">
        <div class="lg:hidden flex items-center gap-2 mb-8">
          <div class="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center font-bold text-white text-xs">PT</div>
          <span class="text-lg font-bold text-ink-700">PermitTrack</span>
        </div>

        <div class="flex rounded-lg bg-slate-200/70 p-1 mb-6">
          <button
            class="flex-1 py-2 text-sm font-semibold rounded-md transition"
            :class="persona === 'applicant' ? 'bg-white shadow text-ink-700' : 'text-slate-500'"
            @click="persona = 'applicant'; mode = 'login'; error = ''"
          >Resident / Business</button>
          <button
            class="flex-1 py-2 text-sm font-semibold rounded-md transition"
            :class="persona === 'staff' ? 'bg-white shadow text-ink-700' : 'text-slate-500'"
            @click="persona = 'staff'; mode = 'login'; error = ''"
          >City Staff</button>
        </div>

        <h1 class="text-2xl font-bold mb-1 text-ink-700">{{ mode === 'login' ? 'Welcome back' : 'Create your account' }}</h1>
        <p class="text-slate-500 text-sm mb-6">
          {{ persona === 'staff' ? 'Sign in with your city staff credentials.' : (mode === 'login' ? 'Log in to track your permits and licenses.' : 'Apply for and track permits online.') }}
        </p>

        <form @submit.prevent="submit" class="space-y-4">
          <div v-if="mode === 'signup'">
            <label class="block text-sm font-semibold text-slate-700 mb-1">Full name</label>
            <input v-model="form.full_name" type="text" required placeholder="Jordan Silva"
              class="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none" />
          </div>
          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-1">Email</label>
            <input v-model="form.email" type="email" required placeholder="jordan.silva@email.com"
              class="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none" />
          </div>
          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-1">Password</label>
            <div class="relative">
              <input v-model="form.password" :type="showPassword ? 'text' : 'password'" required placeholder="••••••••"
                class="w-full rounded-md border border-slate-300 bg-white pl-3 pr-10 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none" />
              <button
                type="button"
                @click="showPassword = !showPassword"
                :aria-label="showPassword ? 'Hide password' : 'Show password'"
                class="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"
              >
                <svg v-if="!showPassword" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/>
                </svg>
                <svg v-else class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a18.6 18.6 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 7 11 7a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><path d="M1 1l22 22"/>
                </svg>
              </button>
            </div>
          </div>

          <div v-if="mode === 'signup'">
            <label class="block text-sm font-semibold text-slate-700 mb-1">I am applying as</label>
            <div class="flex gap-2">
              <button type="button" @click="accountType = 'resident'" class="flex-1 py-2 rounded-md border text-sm font-semibold transition" :class="accountType==='resident' ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-300 text-slate-500 bg-white'">Resident</button>
              <button type="button" @click="accountType = 'business'" class="flex-1 py-2 rounded-md border text-sm font-semibold transition" :class="accountType==='business' ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-300 text-slate-500 bg-white'">Business</button>
            </div>
          </div>

          <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

          <button type="submit" :disabled="loading" class="w-full py-2.5 rounded-md bg-brand-600 text-white font-semibold hover:bg-brand-700 disabled:opacity-60 transition shadow-sm">
            {{ loading ? 'Please wait…' : (mode === 'login' ? 'Log In' : 'Create Account') }}
          </button>
        </form>

        <div v-if="persona === 'applicant'" class="flex items-center gap-3 my-5">
          <div class="flex-1 h-px bg-slate-200"></div>
          <span class="text-xs text-slate-400">or</span>
          <div class="flex-1 h-px bg-slate-200"></div>
        </div>
        <button v-if="persona === 'applicant'" type="button" disabled title="Not available in this demo"
          class="w-full py-2.5 rounded-md border border-slate-300 bg-white text-sm font-semibold text-slate-400 cursor-not-allowed">
          Continue with Google
        </button>

        <p v-if="persona === 'applicant'" class="text-sm text-slate-500 mt-6 text-center">
          <template v-if="mode === 'login'">
            New here?
            <button class="text-brand-600 font-semibold hover:underline" @click="mode = 'signup'; error=''">Create an account</button>
          </template>
          <template v-else>
            Already have an account?
            <button class="text-brand-600 font-semibold hover:underline" @click="mode = 'login'; error=''">Log in</button>
          </template>
        </p>

        <p v-if="persona === 'staff'" class="text-xs text-slate-400 mt-6 text-center">Demo staff login: staff@permittrack.city / password123</p>
      </div>
    </div>
  </div>
  `,
};
