import { useUI } from '../state/UIContext.jsx'
import LogModal from './LogModal.jsx'
import AllEventsModal from './AllEventsModal.jsx'
import BudgetModal from './BudgetModal.jsx'
import InterviewDrawer from './InterviewDrawer.jsx'
import MissingBirthdaysModal from './MissingBirthdaysModal.jsx'
import ConfirmModal from './ui/ConfirmModal.jsx'
import { AddPeopleModal, EditPersonModal } from './person/PersonFormModal.jsx'
import FactModal from './person/FactModal.jsx'
import IntentModal from './person/IntentModal.jsx'
import SayHiModal from './person/SayHiModal.jsx'
import RemovePersonModal from './person/RemovePersonModal.jsx'
import SearchModal from './SearchModal.jsx'
import ImportModal from './ImportModal.jsx'

const REGISTRY = {
  log: LogModal,
  allEvents: AllEventsModal,
  budgets: BudgetModal,
  interview: InterviewDrawer,
  allPeople: MissingBirthdaysModal,
  confirm: ConfirmModal,
  addPeople: AddPeopleModal,
  editPerson: EditPersonModal,
  fact: FactModal,
  intent: IntentModal,
  sayHi: SayHiModal,
  removePerson: RemovePersonModal,
  search: SearchModal,
  import: ImportModal,
}

/** Renders the modal stack on top of whatever route is open. */
export default function ModalHost() {
  const { stack, close } = useUI()
  return stack.map(({ key, type, props }) => {
    const Component = REGISTRY[type]
    return Component ? <Component key={key} {...props} onClose={() => close(key)} /> : null
  })
}
