import { useSearchMessages } from "../../hooks/useGraphQuery";
import { MailList } from "../mail/MailList";

interface SearchResultsProps {
  query: string;
  selectedId: string | null;
  onSelectMessage: (id: string) => void;
}

export function SearchResults({
  query,
  selectedId,
  onSelectMessage,
}: SearchResultsProps) {
  const { data, isLoading } = useSearchMessages(query);
  const messages = data?.value || [];

  return (
    <MailList
      messages={messages}
      selectedId={selectedId}
      isLoading={isLoading}
      folderName={`Search: "${query}"`}
      onSelectMessage={onSelectMessage}
    />
  );
}
