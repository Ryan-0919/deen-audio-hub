const MOCK_EXAM_TICKET_KEY = "mock-exam-ticket-no";
const MOCK_EXAM_CARD_KEY = "mock-exam-card-no";

const isBrowser = () => typeof window !== "undefined";

const readValue = (key: string) => {
  if (!isBrowser()) return "";

  try {
    return window.localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
};

const writeValue = (key: string, value: string) => {
  if (!isBrowser()) return;

  try {
    if (value) window.localStorage.setItem(key, value);
    else window.localStorage.removeItem(key);
  } catch {
    // Ignore storage failures.
  }
};

export const getMockExamTicketNo = () => readValue(MOCK_EXAM_TICKET_KEY);

export const getMockExamCardNo = () => readValue(MOCK_EXAM_CARD_KEY);

export const saveMockExamCandidateInfo = ({
  ticketNo,
  cardNo,
}: {
  ticketNo: string;
  cardNo: string;
}) => {
  writeValue(MOCK_EXAM_TICKET_KEY, ticketNo.trim());
  writeValue(MOCK_EXAM_CARD_KEY, cardNo.trim());
};
