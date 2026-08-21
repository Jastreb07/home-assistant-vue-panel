<script setup lang="ts">
import PopupFrame from './PopupFrame.vue'
import { closePopup, usePopupStack } from './popupService'

/** Renders every open popup and detail dialog, newest on top. */
const stack = usePopupStack()
</script>

<template>
  <PopupFrame
    v-for="request in stack"
    :key="request.key"
    :request="request"
    @close="closePopup(request.key)"
  />
</template>
