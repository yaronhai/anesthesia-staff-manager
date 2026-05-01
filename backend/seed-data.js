module.exports = {
  jobTitles: ['רופא מרדים', 'עוזר מרדים', 'מנהל מחלקה'],

  empTypes: [
    { name: 'שכיר',      is_independent: false },
    { name: 'שכיר-שעתי', is_independent: false },
    { name: 'עצמאי',     is_independent: true  },
  ],

  honorifics: ['ד"ר', "פרופ'", 'מר', "גב'"],

  groupColors: {
    'מרדימים אחראיים': '#ef4444',
    'תורנים':          '#f59e0b',
    'כוננים':          '#8b5cf6',
    'מרפאה טרום ניתוחית': '#ec4899',
    'חדרי ניתוח':      '#3b82f6',
    'אתרים אחרים':     '#10b981',
  },

  // groupName is resolved to a DB id at seed time
  sites: [
    { name: 'חדר ניתוח 1',  groupName: 'חדרי ניתוח' },
    { name: 'חדר ניתוח 2',  groupName: 'חדרי ניתוח' },
    { name: 'חדר ניתוח 3',  groupName: 'חדרי ניתוח' },
    { name: 'חדר ניתוח 4',  groupName: 'חדרי ניתוח' },
    { name: 'חדר ניתוח 5',  groupName: 'חדרי ניתוח' },
    { name: 'חדר ניתוח 6',  groupName: 'חדרי ניתוח' },
    { name: 'חדר ניתוח 7',  groupName: 'חדרי ניתוח' },
    { name: 'חדר ניתוח 8',  groupName: 'חדרי ניתוח' },
    { name: 'חדר ניתוח 9',  groupName: 'חדרי ניתוח' },
    { name: 'חדר ניתוח 10', groupName: 'חדרי ניתוח' },
    { name: 'חדר ניתוח 11', groupName: 'חדרי ניתוח' },
    { name: 'חדר ניתוח 12', groupName: 'חדרי ניתוח' },
    { name: 'חדר ניתוח 13', groupName: 'חדרי ניתוח' },
    { name: 'חדר ניתוח 14', groupName: 'חדרי ניתוח' },
    { name: 'חדר ניתוח 15', groupName: 'חדרי ניתוח' },
    { name: 'חדר ניתוח 16', groupName: 'חדרי ניתוח' },
    { name: 'חדר ניתוח 17', groupName: 'חדרי ניתוח' },
    { name: 'חדר ניתוח 18', groupName: 'חדרי ניתוח' },
    { name: 'IVF',           groupName: 'אתרים אחרים' },
    { name: 'גסטרו',         groupName: 'אתרים אחרים' },
  ],

  shiftTypes: [
    { key: 'morning', label_he: 'בוקר',   label_short: 'ב', icon: '☀',  color: '#b45309', bg_color: '#fef3c7', show_in_assignments: true,  show_in_availability_bar: true,  sort_order: 1, default_start: '07:00', default_end: '15:00' },
    { key: 'evening', label_he: 'ערב',    label_short: 'ע', icon: '🌙', color: '#1e40af', bg_color: '#dbeafe', show_in_assignments: true,  show_in_availability_bar: true,  sort_order: 2, default_start: '15:00', default_end: '23:00' },
    { key: 'night',   label_he: 'תורנות', label_short: 'ת', icon: '⭐', color: '#1f2937', bg_color: '#f3f4f6', show_in_assignments: true,  show_in_availability_bar: false, sort_order: 3, default_start: '15:00', default_end: '07:00' },
    { key: 'oncall',  label_he: 'כוננות', label_short: 'כ', icon: '📞', color: '#5b21b6', bg_color: '#ede9fe', show_in_assignments: false, show_in_availability_bar: false, sort_order: 4, default_start: '15:00', default_end: '07:00' },
  ],

  preferenceTypes: [
    { key: 'can',    label_he: 'יכול',    label_group_he: 'יכולים',    color: '#10b981', sort_order: 1 },
    { key: 'prefer', label_he: 'מעדיף',   label_group_he: 'מעדיפים',   color: '#f59e0b', sort_order: 2 },
    { key: 'cannot', label_he: 'לא יכול', label_group_he: 'לא יכולים', color: '#ef4444', sort_order: 3 },
  ],
};
