<script setup lang="ts">
import { Primitive, type PrimitiveProps } from 'reka-ui'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../../lib/utils'
import type { HTMLAttributes } from 'vue'

const variants = cva('', {
  variants: {
    variant: { default: 'small-button', primary: 'small-button primary', icon: 'icon-button' },
  },
  defaultVariants: { variant: 'default' },
})
interface Props extends PrimitiveProps {
  variant?: VariantProps<typeof variants>['variant']
  class?: HTMLAttributes['class']
}
const props = withDefaults(defineProps<Props>(), { as: 'button' })
</script>

<template>
  <Primitive :as="as" :as-child="asChild" :class="cn(variants({ variant }), props.class)">
    <slot />
  </Primitive>
</template>
