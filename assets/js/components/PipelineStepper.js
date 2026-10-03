// The route one application actually takes, office by office. There is no fixed number of nodes:
// a Certificate of Residency is a single stop at a barangay, a Building Permit is up to nine, and
// what is drawn here is whatever application_pipeline_progress holds for that application.
//
// compact  — a row of dots, one per node, with a line naming the office currently holding it.
//            Used on collapsed cards, where the question is only "where is it?".
// full     — every node listed with its office and the work done there.
//
// StatusStepper (the fixed Submitted → … → Approved bar) stays for pre-pipeline applications,
// which have no rows here.
export default {
  name: 'PipelineStepper',
  props: {
    // Rows from application_pipeline_progress: step_label, status, department_name, department_code
    pipeline: { type: Array, required: true },
    compact: { type: Boolean, default: false },
    // A document needing re-upload holds the route up without rejecting it
    blocked: { type: Boolean, default: false },
    // The application's own status. Withdrawn stops a route without marking any node, so the
    // position has to come from here rather than from the rows.
    status: { type: String, default: '' },
  },
  computed: {
    currentIndex() {
      const i = this.pipeline.findIndex((s) => s.status === 'current');
      return i;
    },
    current() {
      return this.currentIndex === -1 ? null : this.pipeline[this.currentIndex];
    },
    rejectedAt() {
      return this.pipeline.find((s) => s.status === 'rejected') || null;
    },
    approvedCount() {
      return this.pipeline.filter((s) => s.status === 'approved').length;
    },
    isComplete() {
      return this.pipeline.length > 0 && this.approvedCount === this.pipeline.length;
    },
    // "Stop 3 of 6" — the position people actually ask about
    positionLabel() {
      if (this.withdrawn) return 'Withdrawn';
      if (this.rejectedAt) return 'Stopped at ' + this.rejectedAt.department_name;
      if (this.isComplete) return this.pipeline.length === 1 ? 'Cleared' : 'All ' + this.pipeline.length + ' stops cleared';
      if (!this.current) return '';
      return 'Stop ' + (this.currentIndex + 1) + ' of ' + this.pipeline.length;
    },
    withdrawn() {
      return this.status === 'Withdrawn';
    },
  },
  methods: {
    dotClass(step, i) {
      if (this.withdrawn && step.status !== 'approved') return 'bg-white border-slate-200 text-slate-300';
      if (step.status === 'approved') return 'bg-brand-600 border-brand-600 text-white';
      if (step.status === 'rejected') return 'bg-red-500 border-red-500 text-white';
      if (step.status === 'current') {
        return this.blocked
          ? 'bg-red-500 border-red-500 text-white ring-4 ring-red-100'
          : 'bg-amber-500 border-amber-500 text-white ring-4 ring-amber-100';
      }
      return 'bg-white border-slate-300 text-slate-400'; // pending, or skipped after a rejection
    },
    lineClass(step) {
      return step.status === 'approved' ? 'bg-brand-600' : 'bg-slate-200';
    },
  },
  template: `
  <div class="w-full">
    <!-- Collapsed: one dot per real node, then where it actually is -->
    <template v-if="compact">
      <ol class="flex items-center w-full">
        <li v-for="(step, i) in pipeline" :key="i" class="flex items-center" :class="i === pipeline.length - 1 ? '' : 'flex-1'">
          <span class="w-3.5 h-3.5 rounded-full border-2 shrink-0" :class="dotClass(step, i)"
            :title="step.department_name + ' — ' + step.step_label"></span>
          <span v-if="i !== pipeline.length - 1" class="flex-1 h-0.5 mx-1" :class="lineClass(step)"></span>
        </li>
      </ol>
      <p class="mt-2 text-xs leading-snug">
        <span class="font-semibold" :class="rejectedAt ? 'text-red-600' : withdrawn ? 'text-slate-400' : isComplete ? 'text-brand-700' : 'text-slate-700'">{{ positionLabel }}</span>
        <template v-if="current && !rejectedAt && !isComplete && !withdrawn">
          <span class="text-slate-400"> · </span>
          <span class="text-slate-600">{{ current.department_name }}</span>
          <span class="block text-slate-400">{{ current.step_label }}</span>
        </template>
      </p>
    </template>

    <!-- Expanded: the whole route, named. Vertical, so it reads the same at one node or nine. -->
    <ol v-else class="space-y-3">
      <li v-for="(step, i) in pipeline" :key="i" class="flex items-start gap-3 text-sm">
        <span class="w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 text-xs font-bold" :class="dotClass(step, i)">
          <svg v-if="step.status === 'approved'" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
          <svg v-else-if="step.status === 'rejected'" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
          <span v-else-if="step.status === 'current' && !withdrawn" class="w-2 h-2 rounded-full bg-white"></span>
          <span v-else>{{ i + 1 }}</span>
        </span>
        <div class="min-w-0">
          <div class="font-semibold" :class="step.status === 'pending' || step.status === 'skipped' ? 'text-slate-400' : 'text-slate-700'">
            {{ step.department_name }}
          </div>
          <div class="text-xs" :class="step.status === 'current' && !withdrawn ? 'text-amber-700 font-semibold' : 'text-slate-400'">{{ step.step_label }}</div>
        </div>
      </li>
    </ol>
  </div>
  `,
};
