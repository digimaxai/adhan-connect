export const ENQUIRY_CATEGORIES = [
  { id: 'prayer_facilities', label: 'Prayer & mosque facilities', optional: false, reasons: ['Prayer or Jumu’ah arrangements', 'Eid arrangements', 'Opening hours', 'Women’s facilities', 'Accessibility'] },
  { id: 'education', label: 'Classes & Islamic education', optional: true, reasons: ['Children’s enrolment', 'Adult Qur’an classes', 'Arabic or Islamic studies', 'Class times or fees'] },
  { id: 'nikah', label: 'Nikah & marriage arrangements', optional: true, reasons: ['Availability', 'Requirements or documents', 'Fees', 'Request an appointment'] },
  { id: 'funeral', label: 'Funeral & bereavement', optional: true, reasons: ['Funeral arrangements', 'Janazah prayer', 'Burial information'] },
  { id: 'new_muslim', label: 'New to Islam / Shahadah', optional: true, reasons: ['Learn about Islam', 'Arrange Shahadah', 'Beginner classes', 'Arrange a first visit'] },
  { id: 'practical_support', label: 'Financial & practical support', optional: true, reasons: ['Food support', 'Ask about financial assistance', 'Ask about Zakat assistance'] },
  { id: 'donations_volunteering', label: 'Donations & volunteering', optional: false, reasons: ['Donation information', 'Donation query or receipt', 'Volunteer', 'Help with an activity'] },
  { id: 'events_visits', label: 'Events, visits & venue hire', optional: true, reasons: ['Event enquiry', 'School or group visit', 'Venue availability', 'Booking requirements'] },
  { id: 'feedback', label: 'Feedback / report a problem', optional: false, reasons: ['Facilities or cleanliness', 'Incorrect published information', 'Suggestion', 'General feedback'] },
  { id: 'other', label: 'Other enquiry', optional: false, reasons: ['Something else'] },
] as const;
export type EnquiryCategoryId = typeof ENQUIRY_CATEGORIES[number]['id'];
export const enquiryCategory = (id: string) => ENQUIRY_CATEGORIES.find((c) => c.id === id);
export const ENQUIRY_STATUS_LABELS = { new: 'New', in_progress: 'In progress', waiting_for_listener: 'Waiting for you', resolved: 'Resolved' } as const;
