import LeadInboxView from './LeadInbox/LeadInboxView.jsx';
import { useLeadInboxController } from '../hooks/useLeadInboxController.jsx';

export const LeadInbox = (props) => {
  const viewModel = useLeadInboxController(props);
  return <LeadInboxView {...viewModel} />;
};

export {
  SAVED_FILTERS_STORAGE_KEY,
  SAVED_VIEWS_STORAGE_KEY,
  SAVED_VIEWS_LIMIT,
  THIRTY_DAYS_MS,
  NO_QUEUE_VALUE,
  defaultFilters,
  TIME_WINDOW_OPTIONS,
  normalizeFilters,
  serializeFilters,
  filterAllocationsWithFilters,
  loadStoredFilters,
  loadStoredViews,
  resolveQueueValue,
} from '../utils/filtering.js';

export default LeadInbox;
