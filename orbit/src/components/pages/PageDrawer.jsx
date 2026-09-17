import { useUI } from '../../state/UIContext.jsx'
import Modal from '../ui/Modal.jsx'
import SettingsPage from './SettingsPage.jsx'
import ConnectorsPage from './ConnectorsPage.jsx'
import HowItWorksPage from './HowItWorksPage.jsx'

export const PAGES = {
  settings: { title: 'Settings', Page: SettingsPage },
  connectors: { title: 'Connectors', Page: ConnectorsPage },
  how: { title: 'How it works', Page: HowItWorksPage },
}

export default function PageDrawer({ page }) {
  const { back } = useUI()
  const { title, Page } = PAGES[page]
  return (
    <Modal variant="drawer" eyebrow="Orbit" title={title} onClose={back} size="lg">
      <Page />
    </Modal>
  )
}
