import { computed, readonly, ref, type Ref } from 'vue'
import { getConnection, useEntities, useHaAdministrator } from './connection'

/**
 * The two counters Home Assistant paints on its own sidebar, rebuilt here so
 * a menu card can mirror them.
 *
 * Both follow HA's `ha-sidebar` exactly (see the frontend's
 * `src/components/ha-sidebar.ts`):
 *
 * - Settings: installable updates plus open repair issues. HA adds the two
 *   into a single badge, so this does the same.
 * - Notifications: the number of persistent notifications.
 */

/** Bit 1 of `supported_features` on an update entity: it can be installed. */
const UPDATE_FEATURE_INSTALL = 1

interface PersistentNotification {
  notification_id: string
}

interface NotificationMessage {
  type: 'added' | 'removed' | 'current' | 'updated'
  notifications: Record<string, PersistentNotification>
}

interface RepairsMessage {
  issues: { ignored?: boolean }[]
}

const notificationCount = ref(0)
const issueCount = ref(0)
let started = false

/**
 * HA streams notifications as deltas, so the full set has to be kept here —
 * only 'removed' takes entries out, everything else merges in.
 */
function trackNotifications(): void {
  const connection = getConnection()
  if (!connection) return

  const known = new Map<string, PersistentNotification>()

  void connection.subscribeMessage<NotificationMessage>(
    (message) => {
      if (message.type === 'removed') {
        for (const id of Object.keys(message.notifications)) known.delete(id)
      } else {
        for (const [id, entry] of Object.entries(message.notifications)) known.set(id, entry)
      }
      notificationCount.value = known.size
    },
    { type: 'persistent_notification/subscribe' },
  )
}

/**
 * Repair issues are admin-only in HA — a non-admin subscription would just
 * error, so it is not attempted. Ignored issues do not count.
 */
function trackRepairs(administrator: Readonly<Ref<boolean>>): void {
  const connection = getConnection()
  if (!connection || !administrator.value) return

  const apply = (issues: RepairsMessage['issues']) => {
    issueCount.value = issues.filter((issue) => !issue.ignored).length
  }

  void connection
    .sendMessagePromise<RepairsMessage>({ type: 'repairs/list_issues' })
    .then((message) => apply(message.issues ?? []))
    .catch(() => {
      /* Older cores without the repairs API simply report no issues. */
    })

  void connection.subscribeEvents(() => {
    void connection
      .sendMessagePromise<RepairsMessage>({ type: 'repairs/list_issues' })
      .then((message) => apply(message.issues ?? []))
      .catch(() => {})
  }, 'repairs_issue_registry_updated')
}

/**
 * Counters for the Home Assistant sidebar badges. Subscriptions are opened
 * once for the whole engine and live as long as the panel does.
 */
export function useHostBadges() {
  const entities = useEntities()
  const administrator = useHaAdministrator()

  if (!started) {
    started = true
    trackNotifications()
    trackRepairs(administrator)
  }

  /**
   * An update counts when it is on and actually installable — HA hides the
   * ones it cannot act on, and so does this.
   */
  const updateCount = computed(() => {
    let count = 0
    for (const [entityId, state] of Object.entries(entities.value)) {
      if (!entityId.startsWith('update.')) continue
      if (state?.state !== 'on') continue
      const features = Number(state.attributes?.supported_features ?? 0)
      if ((features & UPDATE_FEATURE_INSTALL) !== 0) count += 1
    }
    return count
  })

  const settings = computed(() => updateCount.value + issueCount.value)

  return { settings, notifications: readonly(notificationCount) }
}
