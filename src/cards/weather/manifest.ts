import { defineCard } from '@/core/registry/cardRegistry'
import { NATIVE_GROUP } from '@/core/registry/cardGroups'

/**
 * In the sidebar the card sits directly on the bar background — no tile,
 * no shadow. Shared by every sidebar slot.
 */
const BARE = `.weather-card {
  background: none;
  box-shadow: none;
  border-radius: 0;
  padding: 0;
  min-height: 0;
}`

/**
 * Applied whenever the "Animation" option is on: `.animated` enables the
 * moving background, `.cond-<state>` picks the look for the current
 * weather. Shipped as default CSS so it is visible and editable in the
 * card's CSS tab.
 */
const ANIMATION = `.weather-card.animated {
  background-image: linear-gradient(120deg, #4b5a6b, #2b3542);
  background-size: 200% 200%;
  animation: vp-weather-pan 18s ease-in-out infinite;
  color: #fff;
  position: relative;
  overflow: hidden;
  /* The bars strip padding — a colored surface needs it back */
  padding: 16px;
  border-radius: var(--card-radius);
}
@keyframes vp-weather-pan {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}

/* Per condition */
.weather-card.animated.cond-sunny {
  background-image: linear-gradient(120deg, #f6b73c, #eb7a28, #f6b73c);
}
.weather-card.animated.cond-clear-night {
  background-image: linear-gradient(120deg, #1b2a4a, #0d1526, #1b2a4a);
}
.weather-card.animated.cond-partlycloudy {
  background-image: linear-gradient(120deg, #6b8cae, #9fb3c8, #6b8cae);
}
.weather-card.animated.cond-cloudy,
.weather-card.animated.cond-fog {
  background-image: linear-gradient(120deg, #5c6672, #8a94a1, #5c6672);
}
.weather-card.animated.cond-rainy,
.weather-card.animated.cond-pouring,
.weather-card.animated.cond-snowy-rainy,
.weather-card.animated.cond-hail {
  background-image: linear-gradient(120deg, #3c5a73, #24384a, #3c5a73);
}
.weather-card.animated.cond-snowy {
  background-image: linear-gradient(120deg, #8fa6bd, #cfdae6, #8fa6bd);
  color: #1c2330;
}
.weather-card.animated.cond-windy,
.weather-card.animated.cond-windy-variant {
  background-image: linear-gradient(120deg, #4f7a6b, #7aa697, #4f7a6b);
}
.weather-card.animated.cond-lightning,
.weather-card.animated.cond-lightning-rainy {
  background-image: linear-gradient(120deg, #2b2c4a, #4a3f6b, #2b2c4a);
  animation: vp-weather-pan 18s ease-in-out infinite, vp-weather-flash 6s steps(1) infinite;
}
@keyframes vp-weather-flash {
  0%, 92%, 100% { filter: brightness(1); }
  94% { filter: brightness(1.6); }
  96% { filter: brightness(1); }
  98% { filter: brightness(1.45); }
}

/* Falling streaks for rain and snow */
.weather-card.animated.cond-rainy::after,
.weather-card.animated.cond-pouring::after,
.weather-card.animated.cond-snowy-rainy::after,
.weather-card.animated.cond-snowy::after {
  content: '';
  position: absolute;
  inset: -20% 0;
  pointer-events: none;
  opacity: 0.35;
  background-image: repeating-linear-gradient(
    72deg,
    rgba(255, 255, 255, 0.55) 0 1px,
    transparent 1px 9px
  );
  animation: vp-weather-fall 0.65s linear infinite;
}
.weather-card.animated.cond-pouring::after {
  opacity: 0.5;
  animation-duration: 0.42s;
}
.weather-card.animated.cond-snowy::after {
  background-image: radial-gradient(rgba(255, 255, 255, 0.9) 1.4px, transparent 1.6px);
  background-size: 22px 22px;
  animation-duration: 4.5s;
}
@keyframes vp-weather-fall {
  from { transform: translateY(-22%); }
  to { transform: translateY(22%); }
}

/* Keep the text readable on the colored backgrounds */
.weather-card.animated .state,
.weather-card.animated .details {
  opacity: 0.85;
}

@media (prefers-reduced-motion: reduce) {
  .weather-card.animated,
  .weather-card.animated::after {
    animation: none;
  }
}`

export default defineCard({
  type: 'weather',
  name: 'cards.weather.name',
  icon: 'mdi:weather-partly-cloudy',
  group: NATIVE_GROUP,
  component: () => import('./WeatherCard.vue'),
  schema: {
    entity: { type: 'entity', domain: 'weather', label: 'cards.weather.entity' },
    name: { type: 'string', label: 'cards.weather.displayName', optional: true },
    showDetails: { type: 'boolean', label: 'cards.weather.showDetails', default: true },
    roundTemperature: {
      type: 'boolean',
      label: 'cards.weather.roundTemperature',
      default: true,
    },
    animation: { type: 'boolean', label: 'cards.weather.animation', default: false },
  },
  defaultSize: { cols: 1, rows: 1, width: 140, height: 120 },
  areas: ['dashboard', 'sidebar_top', 'sidebar_center', 'sidebar_bottom'],
  css: {
    default: ANIMATION,
    sidebar_top: `${BARE}\n\n${ANIMATION}`,
    sidebar_center: `${BARE}\n\n${ANIMATION}`,
    sidebar_bottom: `${BARE}\n\n${ANIMATION}`,
  },
})
