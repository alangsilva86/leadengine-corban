import useConversationExperience from './hooks/useConversationExperience.js';
import ConversationAreaView from './ConversationAreaView.jsx';

export const ConversationArea = (props) => {
  const { timeline, composer, header } = useConversationExperience(props);

  return <ConversationAreaView timeline={timeline} composer={composer} header={header} />;
};

export default ConversationArea;
