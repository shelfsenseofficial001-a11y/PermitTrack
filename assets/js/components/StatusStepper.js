export default {
  name: 'StatusStepper',
  props: {
    stages: { type: Array, required: true },
    activeIndex: { type: Number, required: true },
    compact: { type: Boolean, default: false },
    rejected: { type: Boolean, default: false },
    blocked: { type: Boolean, default: false },
  },
  template: `
    <div class="w-full">
      <div v-if="rejected" class="text-sm font-semibold text-red-600 flex items-center gap-1.5">
        <span class="w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center text-xs">✕</span>
        Application Rejected
      </div>
      <ol v-else class="flex items-center w-full">
        <li v-for="(stage, i) in stages" :key="stage" class="flex items-center" :class="i === stages.length - 1 ? '' : 'flex-1'">
          <div class="flex flex-col items-center" :class="compact ? 'gap-1' : 'gap-2'">
            <div
              class="rounded-full flex items-center justify-center font-semibold shrink-0 border-2"
              :class="[
                compact ? 'w-3.5 h-3.5' : 'w-8 h-8 text-sm',
                i < activeIndex ? 'bg-brand-600 border-brand-600 text-white' :
                  i === activeIndex ? (blocked ? 'bg-red-500 border-red-500 text-white ring-4 ring-red-100' : 'bg-amber-500 border-amber-500 text-white ring-4 ring-amber-100') :
                  'bg-white border-slate-300 text-slate-400'
              ]"
            >
              <template v-if="!compact">
                <span v-if="i < activeIndex">✓</span>
                <span v-else-if="i === activeIndex" class="w-2 h-2 rounded-full bg-white"></span>
              </template>
            </div>
            <span v-if="!compact" class="text-xs text-center max-w-[6.5rem]" :class="i <= activeIndex ? 'text-slate-800 font-semibold' : 'text-slate-400'">{{ stage }}</span>
          </div>
          <div v-if="i !== stages.length - 1" class="flex-1 mx-1" :class="[compact ? 'h-0.5' : 'h-0.5 mb-6', i < activeIndex ? 'bg-brand-600' : 'bg-slate-200']"></div>
        </li>
      </ol>
    </div>
  `,
};
