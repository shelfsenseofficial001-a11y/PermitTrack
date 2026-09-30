import { apiGet, apiPost, apiPostForm } from '../api/client.js?v=67';
import AppShell from './AppShell.js?v=67';
import { authState, loadCurrentUser } from '../store/auth.js?v=67';
import { formatDate, backButtonClass, backIconClass } from '../util.js?v=67';
import Loader from './Loader.js?v=67';

const inputClass = 'w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm placeholder:text-slate-400 focus:ring-4 focus:ring-brand-600/15 focus:border-brand-600 outline-none transition';
const labelClass = 'block text-sm font-semibold text-slate-700 mb-1.5';

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default {
  name: 'ResidencyUpgrade',
  setup: () => ({ backButtonClass, backIconClass }),
  components: { AppShell, Loader },
  data() {
    return {
      authState,
      loading: true,
      docTypes: [],
      maxFileMb: 5,
      request: null,
      // Adding the missing email/mobile
      contact: { value: '', sending: false, sentTo: '', code: '', verifying: false, error: '', devCode: '' },
      address: { address_line: '', barangay: '', city: '', postal_code: '' },
      proofs: [
        { doc_type: '', issued_on: '', file: null },
        { doc_type: '', issued_on: '', file: null },
      ],
      declaration: false,
      submitting: false,
      error: '',
      today: today(),
      inputClass, labelClass,
    };
  },
  computed: {
    user() {
      return this.authState.user;
    },
    status() {
      return this.user ? this.user.resident_status : 'none';
    },
    emailVerified() {
      return !!(this.user && this.user.email_verified_at);
    },
    phoneVerified() {
      return !!(this.user && this.user.phone_verified_at);
    },
    // The contact the user still needs to add ('email' | 'sms' | null)
    missingChannel() {
      if (!this.emailVerified) return 'email';
      if (!this.phoneVerified) return 'sms';
      return null;
    },
    canEditForm() {
      return this.status === 'none' || this.status === 'rejected';
    },
  },
  async mounted() {
    await this.refresh();
  },
  methods: {
    formatDate,
    typeInfo(value) {
      return this.docTypes.find((t) => t.value === value) || null;
    },
    fileSize(bytes) {
      return bytes >= 1048576 ? (bytes / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(bytes / 1024)) + ' KB';
    },
    fileUrl(proofId) {
      return 'api/residency.php?action=file&id=' + proofId;
    },
    async refresh() {
      this.loading = true;
      const res = await apiGet('residency.php?action=status');
      this.docTypes = res.doc_types;
      this.maxFileMb = res.max_file_mb;
      this.request = res.request;
      const u = this.user || {};
      this.address = { address_line: u.address_line || '', barangay: u.barangay || '', city: u.city || '', postal_code: u.postal_code || '' };
      this.loading = false;
    },
    async sendContactCode(resend = false) {
      const c = this.contact;
      c.error = '';
      c.sending = true;
      try {
        const { verification } = await apiPost('account.php?action=add_contact', { channel: this.missingChannel, value: c.value, resend });
        c.sentTo = verification.sent_to;
        c.devCode = verification.dev_code || '';
        c.code = '';
      } catch (e) {
        c.error = e.message;
      } finally {
        c.sending = false;
      }
    },
    async verifyContactCode() {
      const c = this.contact;
      c.error = '';
      c.verifying = true;
      try {
        const { user } = await apiPost('account.php?action=verify_contact', { channel: this.missingChannel, code: c.code });
        this.authState.user = user;
        this.contact = { value: '', sending: false, sentTo: '', code: '', verifying: false, error: '', devCode: '' };
      } catch (e) {
        c.error = e.message;
      } finally {
        c.verifying = false;
      }
    },
    onFile(i, event) {
      const file = event.target.files[0] || null;
      this.error = '';
      if (file && file.size > this.maxFileMb * 1048576) {
        this.error = `Proof #${i + 1} is too large. The limit is ${this.maxFileMb} MB.`;
        event.target.value = '';
        return;
      }
      this.proofs[i].file = file;
    },
    // Mirrors the server rules so problems show before uploading
    formError() {
      if (this.missingChannel) return 'Please verify both your email and your mobile number first.';
      const a = this.address;
      if (!a.address_line.trim() || !a.barangay.trim() || !a.city.trim()) return 'Please complete your address.';
      if (!/^\d{4}$/.test(a.postal_code.trim())) return 'Postal / ZIP code must be 4 digits.';
      for (let i = 0; i < 2; i++) {
        const p = this.proofs[i];
        const t = this.typeInfo(p.doc_type);
        if (!t) return `Please choose the document type for proof #${i + 1}.`;
        if (t.max_age_days && !p.issued_on) return `Please enter the date issued for proof #${i + 1}.`;
        if (!p.file) return `Please upload a file for proof #${i + 1}.`;
      }
      if (this.proofs[0].doc_type === this.proofs[1].doc_type) return 'Your two proofs must be different types of documents.';
      if (!this.declaration) return 'Please confirm that you currently live at this address.';
      return '';
    },
    async submit() {
      this.error = this.formError();
      if (this.error) return;
      this.submitting = true;
      try {
        const fd = new FormData();
        Object.entries(this.address).forEach(([k, v]) => fd.append(k, v.trim()));
        this.proofs.forEach((p, i) => {
          fd.append(`doc_type_${i + 1}`, p.doc_type);
          if (this.typeInfo(p.doc_type).max_age_days) fd.append(`issued_on_${i + 1}`, p.issued_on);
          fd.append(`file_${i + 1}`, p.file);
        });
        fd.append('declaration', '1');
        await apiPostForm('residency.php?action=submit', fd);
        await loadCurrentUser();
        this.proofs = [{ doc_type: '', issued_on: '', file: null }, { doc_type: '', issued_on: '', file: null }];
        this.declaration = false;
        await this.refresh();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (e) {
        this.error = e.message;
      } finally {
        this.submitting = false;
      }
    },
  },
  template: `
  <AppShell>
    <router-link to="/dashboard" :class="[backButtonClass, 'mb-3']">
      <span :class="backIconClass"><svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg></span>
      Back to Dashboard
    </router-link>

    <div class="pt-gradient-wide rounded-3xl px-6 py-7 sm:px-8 mb-6 shadow-[0_24px_60px_-28px_rgba(31,122,58,0.7)]">
      <p class="text-xs font-bold uppercase tracking-wider text-white/80 mb-1.5">Account upgrade</p>
      <h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-white">Become a verified Resident</h1>
      <p class="text-sm text-white/85 mt-1 max-w-xl">Verified Residents can apply for resident permits. City Staff checks your documents, usually within a few working days.</p>
    </div>

    <Loader v-if="loading" kind="residency" />

    <template v-else>
      <!-- Verified -->
      <div v-if="status === 'verified'" class="bg-white rounded-2xl border border-brand-200 p-6 flex items-start gap-4">
        <div class="w-11 h-11 rounded-xl bg-brand-600 text-sun-300 flex items-center justify-center shrink-0">
          <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
        </div>
        <div>
          <h2 class="font-bold text-ink-700 text-lg">You're a verified Resident</h2>
          <p class="text-sm text-slate-500 mt-1">Verified {{ request && request.reviewed_at ? 'on ' + formatDate(request.reviewed_at) : '' }}. You can now apply for resident permits.</p>
          <router-link to="/applications/new" class="inline-flex mt-4 bg-brand-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-brand-700 transition">Start a New Application</router-link>
        </div>
      </div>

      <!-- Pending -->
      <div v-else-if="status === 'pending' && request" class="bg-white rounded-2xl border border-sun-300 p-6">
        <div class="flex items-start gap-4">
          <div class="w-11 h-11 rounded-xl bg-sun-100 text-sun-700 flex items-center justify-center shrink-0">
            <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          </div>
          <div class="min-w-0">
            <h2 class="font-bold text-ink-700 text-lg">Under review</h2>
            <p class="text-sm text-slate-500 mt-1">Submitted {{ formatDate(request.created_at) }}. We'll notify you by email or SMS once City Staff has checked your documents.</p>
          </div>
        </div>
        <ul class="mt-5 space-y-2">
          <li v-for="p in request.proofs" :key="p.id" class="flex items-center justify-between gap-3 rounded-xl bg-meadow px-4 py-3">
            <div class="min-w-0">
              <div class="text-sm font-semibold text-slate-800 truncate">{{ p.doc_type_label }}</div>
              <div class="text-xs text-slate-500 truncate">{{ p.original_filename }}<span v-if="p.issued_on"> · issued {{ formatDate(p.issued_on) }}</span></div>
            </div>
            <a :href="fileUrl(p.id)" target="_blank" rel="noopener" class="text-xs font-semibold text-brand-700 hover:underline shrink-0">View</a>
          </li>
        </ul>
      </div>

      <!-- Form (new or after a rejection) -->
      <template v-else-if="canEditForm">
        <div v-if="status === 'rejected' && request" class="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl px-5 py-4 mb-6" role="alert">
          <svg class="w-5 h-5 text-red-600 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg>
          <div>
            <div class="text-sm font-bold text-red-700">Your last request wasn't approved</div>
            <p class="text-sm text-red-700 mt-0.5">{{ request.rejection_reason }}</p>
            <p class="text-xs text-red-600 mt-1">Please fix the issue and submit new proofs below.</p>
          </div>
        </div>

        <form @submit.prevent="submit" class="grid lg:grid-cols-3 gap-6" novalidate>
          <div class="lg:col-span-2 space-y-6">
            <!-- 1. Contacts -->
            <section class="bg-white rounded-2xl border border-brand-100 p-6">
              <h2 class="font-bold text-ink-700">1. Email and mobile number</h2>
              <p class="text-sm text-slate-500 mt-1 mb-4">Residents need both verified, so we can reach you about your permits.</p>
              <ul class="space-y-2 mb-1">
                <li class="flex items-center justify-between gap-3 rounded-xl bg-meadow px-4 py-3">
                  <div class="min-w-0"><div class="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</div><div class="text-sm font-medium text-slate-800 truncate">{{ user.email || 'Not added yet' }}</div></div>
                  <span v-if="emailVerified" class="text-xs font-bold px-2.5 py-1 rounded-full bg-brand-100 text-brand-700 shrink-0">✓ Verified</span>
                  <span v-else class="text-xs font-bold px-2.5 py-1 rounded-full bg-sun-100 text-sun-700 shrink-0">Needed</span>
                </li>
                <li class="flex items-center justify-between gap-3 rounded-xl bg-meadow px-4 py-3">
                  <div class="min-w-0"><div class="text-xs font-semibold uppercase tracking-wide text-slate-500">Mobile number</div><div class="text-sm font-medium text-slate-800 truncate">{{ user.phone || 'Not added yet' }}</div></div>
                  <span v-if="phoneVerified" class="text-xs font-bold px-2.5 py-1 rounded-full bg-brand-100 text-brand-700 shrink-0">✓ Verified</span>
                  <span v-else class="text-xs font-bold px-2.5 py-1 rounded-full bg-sun-100 text-sun-700 shrink-0">Needed</span>
                </li>
              </ul>

              <div v-if="missingChannel" class="mt-4 rounded-xl border border-sun-300 bg-sun-50/60 p-4">
                <label :class="labelClass" for="add-contact">{{ missingChannel === 'email' ? 'Add your email' : 'Add your mobile number' }}</label>
                <div class="flex gap-2">
                  <input id="add-contact" v-model="contact.value" :type="missingChannel === 'email' ? 'email' : 'tel'"
                    :placeholder="missingChannel === 'email' ? 'you@email.com' : '0917 123 4567'" :class="inputClass" />
                  <button type="button" @click="sendContactCode(!!contact.sentTo)" :disabled="contact.sending || !contact.value.trim()"
                    class="shrink-0 px-4 rounded-xl bg-ink-700 text-white text-sm font-semibold hover:bg-ink-600 disabled:opacity-50 transition">
                    {{ contact.sending ? 'Sending…' : contact.sentTo ? 'Resend' : 'Send code' }}
                  </button>
                </div>
                <template v-if="contact.sentTo">
                  <p class="text-xs text-slate-500 mt-3 mb-1.5">Enter the 6-digit code we sent to <strong>{{ contact.sentTo }}</strong>.</p>
                  <div class="flex gap-2">
                    <input v-model="contact.code" type="text" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="••••••"
                      :class="inputClass + ' tracking-[0.4em] font-semibold'" aria-label="Verification code" />
                    <button type="button" @click="verifyContactCode" :disabled="contact.verifying || contact.code.length !== 6"
                      class="shrink-0 px-4 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-50 transition">
                      {{ contact.verifying ? 'Checking…' : 'Verify' }}
                    </button>
                  </div>
                  <p v-if="contact.devCode" class="text-xs text-sun-700 mt-2"><strong>Test mode:</strong> code is
                    <button type="button" class="font-mono font-bold underline" @click="contact.code = contact.devCode">{{ contact.devCode }}</button></p>
                </template>
                <p v-if="contact.error" class="text-sm text-red-600 mt-2" role="alert">{{ contact.error }}</p>
              </div>
            </section>

            <!-- 2. Address -->
            <section class="bg-white rounded-2xl border border-brand-100 p-6">
              <h2 class="font-bold text-ink-700">2. Your address</h2>
              <p class="text-sm text-slate-500 mt-1 mb-4">This must match the address on your proofs. Update it here if you've moved.</p>
              <div class="grid sm:grid-cols-2 gap-4">
                <div class="sm:col-span-2">
                  <label :class="labelClass" for="ru-street">House no. / Street</label>
                  <input id="ru-street" v-model="address.address_line" type="text" autocomplete="address-line1" :class="inputClass" />
                </div>
                <div class="sm:col-span-2">
                  <label :class="labelClass" for="ru-brgy">Barangay</label>
                  <input id="ru-brgy" v-model="address.barangay" type="text" :class="inputClass" />
                </div>
                <div>
                  <label :class="labelClass" for="ru-city">City / Municipality</label>
                  <input id="ru-city" v-model="address.city" type="text" autocomplete="address-level2" :class="inputClass" />
                </div>
                <div>
                  <label :class="labelClass" for="ru-zip">Postal code</label>
                  <input id="ru-zip" v-model="address.postal_code" type="text" inputmode="numeric" maxlength="4" autocomplete="postal-code" :class="inputClass" />
                </div>
              </div>
            </section>

            <!-- 3. Proofs -->
            <section class="bg-white rounded-2xl border border-brand-100 p-6">
              <h2 class="font-bold text-ink-700">3. Two proofs of residence</h2>
              <p class="text-sm text-slate-500 mt-1 mb-4">Upload two <strong>different</strong> documents showing your name and this address. PDF, JPG, PNG or WEBP, up to {{ maxFileMb }} MB each.</p>
              <div class="grid sm:grid-cols-2 gap-4">
                <div v-for="(p, i) in proofs" :key="i" class="rounded-2xl border border-slate-200 p-4 space-y-3">
                  <div class="text-xs font-bold uppercase tracking-wider text-brand-700">Proof #{{ i + 1 }}</div>
                  <div>
                    <label :class="labelClass" :for="'ru-type-' + i">Document type</label>
                    <select :id="'ru-type-' + i" v-model="p.doc_type" :class="inputClass">
                      <option value="" disabled>Choose a document…</option>
                      <option v-for="t in docTypes" :key="t.value" :value="t.value" :disabled="proofs[1 - i].doc_type === t.value">{{ t.label }}</option>
                    </select>
                  </div>
                  <div v-if="typeInfo(p.doc_type) && typeInfo(p.doc_type).max_age_days">
                    <label :class="labelClass" :for="'ru-date-' + i">Date issued</label>
                    <input :id="'ru-date-' + i" v-model="p.issued_on" type="date" :max="today" :class="inputClass" />
                    <p class="text-xs text-slate-400 mt-1">Must be within the last {{ typeInfo(p.doc_type).max_age_days }} days.</p>
                  </div>
                  <label class="flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-5 cursor-pointer text-center transition"
                    :class="p.file ? 'border-brand-300 bg-brand-50' : 'border-slate-300 hover:border-brand-300 hover:bg-meadow'">
                    <svg v-if="p.file" class="w-5 h-5 text-brand-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                    <svg v-else class="w-5 h-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/></svg>
                    <span class="text-sm font-semibold break-all" :class="p.file ? 'text-brand-700' : 'text-slate-600'">{{ p.file ? p.file.name : 'Choose a file' }}</span>
                    <span v-if="p.file" class="text-xs text-slate-500">{{ fileSize(p.file.size) }} · click to replace</span>
                    <input type="file" class="sr-only" accept="application/pdf,image/jpeg,image/png,image/webp" @change="onFile(i, $event)" />
                  </label>
                </div>
              </div>
            </section>
          </div>

          <!-- 4. Declaration & submit -->
          <aside class="bg-white rounded-2xl border border-brand-100 p-6 h-fit lg:sticky lg:top-24">
            <h2 class="font-bold text-ink-700 mb-3">4. Declaration</h2>
            <label class="flex items-start gap-3 rounded-xl bg-meadow p-3 cursor-pointer">
              <input v-model="declaration" type="checkbox" class="mt-0.5 w-4 h-4 accent-[#1f7a3a] shrink-0" />
              <span class="text-sm text-slate-600 leading-relaxed">I certify that I currently reside at the address above, and that the documents I'm submitting are genuine.</span>
            </label>
            <p v-if="error" class="text-sm text-red-600 mt-4" role="alert">{{ error }}</p>
            <button type="submit" :disabled="submitting"
              class="w-full mt-4 py-3 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-60 transition shadow-[0_12px_24px_-8px_rgba(31,122,58,0.55)]">
              {{ submitting ? 'Uploading…' : 'Submit for verification' }}
            </button>
            <p class="text-xs text-slate-400 mt-3">Your documents are stored privately and only City Staff can view them.</p>
          </aside>
        </form>
      </template>
    </template>
  </AppShell>
  `,
};
