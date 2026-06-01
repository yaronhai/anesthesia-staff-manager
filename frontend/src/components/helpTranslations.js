export const LANGUAGES = [
  { code: 'he', label: 'עברית',   dir: 'rtl' },
  { code: 'en', label: 'English',  dir: 'ltr' },
  { code: 'ar', label: 'العربية', dir: 'rtl' },
  { code: 'es', label: 'Español',  dir: 'ltr' },
  { code: 'fr', label: 'Français', dir: 'ltr' },
];

export const T = {
  /* ═══════════════════════════════════════════════════ HEBREW */
  he: {
    title: '📖 מדריך למשתמש',
    navUser: 'למשתמש',
    navAdmin: 'למנהל',
    adminDivider: 'כרטיסיות מנהל',
    colSymbol: 'סמל', colName: 'שם', colDesc: 'תיאור', colMeaning: 'משמעות',
    colStatus: 'סטטוס', colTab: 'לשונית', colColor: 'צבע',

    profile: {
      nav: 'הפרופיל שלי', h2: 'הפרופיל שלי',
      desc: 'כרטיסייה לניהול הפרטים האישיים שלך במערכת.',
      h3Edit: 'עריכת פרטים אישיים',
      editItems: [
        'טלפון נייד, כתובת אימייל אישית',
        'שינויים אלו דורשים אישור מנהל לפני שיתעדכנו בפועל',
        'בקשות שינוי ממתינות מסומנות כ"ממתין לאישור"',
      ],
      h3Photo: 'תמונת פרופיל',
      photoSteps: [
        'לחץ על עיגול התמונה',
        'בחר "העלה תמונה" או "צלם מצלמה"',
        'חתוך את התמונה בחלון החיתוך',
        'לחץ "שמור" — התמונה מתעדכנת מייד',
      ],
    },

    shifts: {
      nav: 'בקשות משמרות', h2: 'בקשות משמרות',
      desc: 'לוח חודשי לניהול העדפות המשמרות שלך.',
      h3Types: 'סוגי משמרות',
      shiftRows: [
        ['☀️', 'בוקר', 'משמרת בוקר רגילה'],
        ['🌙', 'ערב', 'משמרת ערב'],
        ['📞', 'כוננות', 'כוננות מהבית'],
        ['⭐', 'תורנות', 'תורנות לילה'],
      ],
      h3Pref: 'רמות העדפה',
      prefRows: [
        ['💚', 'מועדף', 'מעוניין במשמרת זו'],
        ['💙', 'יכול', 'מסוגל לעבוד במשמרת זו'],
        ['❌', 'לא יכול', 'לא זמין במשמרת זו'],
      ],
      h3How: 'כיצד לבצע בקשה',
      howSteps: [
        'בחר את החודש הרצוי עם חיצי הניווט',
        'לחץ על תא יום + משמרת בלוח',
        'לחץ שוב לעבור בין ההעדפות: 💚 ← 💙 ← ❌ ← (ריק)',
        'השינויים נשמרים אוטומטית',
      ],
      h3Default: 'ברירת מחדל שבועית',
      defaultDesc: 'ניתן להגדיר תבנית חוזרת לכל יום בשבוע — היא תחול אוטומטית על חודשים עתידיים.',
      h3Lock: 'מצב נעילה',
      lockDesc: 'כאשר הסידור נעול לא ניתן לשנות בקשות. הלוח מציג הודעת נעילה עם תאריך הפתיחה הצפוי. מנהל יכול לפתוח "חלון חריגה" זמני.',
      h3Approval: 'אישור שינויים על-ידי עובד',
      approvalWorkerItems: [
        'כאשר מנהל משנה או מבטל בקשת משמרת שלך, ייתכן שתישלח אליך בקשת אישור',
        'תקבל/י הודעת צ\'אט עם פרטי השינוי',
        'לחץ/י "✅ כן, אני מאשר/ת" לאישור — השינוי יישמר',
        'לחץ/י "❌ לא, אני דוחה" לדחייה — הבקשה תחזור להעדפה המקורית',
        'תא המשמרת מציג ⏳ עד לתגובתך',
      ],
      approvalAdminItems: [
        'בחר/י "כן, שלח לעובד" — הודעה נשלחת לצ\'אט עם כפתורי אישור/דחייה',
        'בחר/י "לא, שנה/בטל בעצמי" — השינוי נשמר ומסומן כ"שינוי מנהל" ללא הודעה',
        'ניתן להוסיף הודעה אישית שתצורף לפנייה',
        'תקבל/י הודעת צ\'אט ברגע שהעובד יענה',
      ],
    },

    vacations: {
      nav: 'בקשות חופשה', h2: 'בקשות חופשה',
      h3Submit: 'הגשת בקשה',
      submitSteps: [
        'לחץ "בקשת חופשה חדשה"',
        'בחר תאריך התחלה ותאריך סיום',
        'הוסף הערה (אופציונלי)',
        'לחץ "שלח בקשה"',
      ],
      h3Status: 'סטטוסים',
      statusRows: [
        ['ממתין', 'הוגשה, טרם נבדקה'],
        ['אושר', 'המנהל אישר'],
        ['חלקי', 'חלק מהתאריכים אושרו'],
        ['נדחה', 'נדחתה (ייתכן שיש הסבר מהמנהל)'],
        ['בוטל', 'העובד ביטל'],
      ],
      h3Cancel: 'ביטול בקשה',
      cancelDesc: 'ניתן לבטל בקשה בסטטוס "ממתין" בלבד: לחץ על הבקשה ← "בטל בקשה".',
    },

    messages: {
      nav: 'הודעות', h2: 'הודעות',
      h3Direct: 'שיחות ישירות',
      directDesc: 'לחץ על שם עובד/מנהל ברשימה לפתיחת שיחה. הקלד הודעה ולחץ Enter או כפתור השליחה.',
      h3Content: 'סוגי תוכן',
      contentItems: ['טקסט חופשי', 'תמונות (JPG, PNG)', 'מסמכים (PDF, Word)', 'סרטונים', 'קישורים — מוצגת תצוגה מקדימה אוטומטית'],
      h3Badge: 'תג הודעות שלא נקראו',
      badgeDesc: 'אייקון ההודעות (💬) בתפריט מציג ספירה של הודעות שלא נקראו.',
      h3ShiftApproval: 'אישורי שינויי משמרות',
      shiftApprovalItems: [
        'כאשר מנהל שולח בקשת אישור לשינוי משמרת, היא מופיעה כהודעה מודגשת מיוחדת',
        'לחץ/י "✅ כן, אני מאשר/ת" או "❌ לא, אני דוחה" ישירות בצ\'אט',
        'לאחר מענה, הכפתורים מוחלפים בתווית סטטוס (אושר / נדחה)',
        'המנהל מקבל הודעה אוטומטית עם תשובתך',
      ],
    },

    workers: {
      nav: 'ניהול עובדים', h2: 'ניהול עובדים',
      h3List: 'רשימת עובדים',
      listItems: [
        'חיפוש לפי שם או מספר ת.ז.',
        'סינון לפי תפקיד, סוג העסקה, פעיל/לא פעיל',
        'מיון לפי כל עמודה',
        'הדפסה וייצוא: בחר שדות ← לחץ "הדפס"',
      ],
      h3Add: 'הוספת עובד חדש — 4 לשוניות',
      addColTab: 'לשונית', addColFields: 'שדות מרכזיים',
      addRows: [
        ['פרטים אישיים', 'תואר, שם, ת.ז., טלפון, תמונה'],
        ['פרטים ארגוניים', 'תפקיד, סוג העסקה, אימייל ארגוני, סיווג'],
        ['שיוך לסניפים', 'סניף ראשי, סניפים משניים (סופר-מנהל)'],
        ['הרשאות פעילות', 'זמינה לאחר שמירת העובד'],
      ],
      h3Auth: 'הרשאות פעילות',
      authSteps: [
        'פתח עובד ← לשונית "הרשאות פעילות"',
        'לחץ "הוסף הרשאה"',
        'בחר סוג פעילות',
        'הגדר עדיפות (1–5) — 5 = עדיפות גבוהה ביותר בשיבוץ אוטומטי',
      ],
      tip: 'מספר ת.ז. הופך לשם המשתמש לכניסה למערכת. יצירת עובד יוצרת חשבון משתמש אוטומטית.',
    },

    rooms: {
      nav: 'שיבוצים לחדרים', nav_manual: '↳ שיבוץ ידני', nav_auto: '↳ שיבוץ אוטומטי',
      h2: 'שיבוצים לחדרים',
      desc: 'הכרטיסייה המרכזית לניהול השיבוצים היומיים. מציגה לוח חודשי שבו כל תא הוא יום.',
      h3Colors: 'צבעי מצב בלוח',
      colorRows: [
        ['ירוק', 'העובד הגיש בקשה "מועדף"'],
        ['כחול', 'העובד הגיש בקשה "יכול"'],
        ['אפור', 'לא הגיש בקשה'],
        ['אדום/כתום', 'עובד בחופשה'],
      ],
      h2Manual: 'שיבוץ ידני',
      manualSteps: [
        'בחר חודש עם חיצי הניווט',
        'לחץ על תא יום בלוח — ייפתח חלון יומי (ניתן לגרירה)',
        'מצא אתר ברשימה ← לחץ "הוסף שיבוץ"',
        'בחר עובד — ירוק = "מועדף", כחול = "יכול"',
        'בחר סוג פעילות וסוג משמרת',
        'לחץ "שמור"',
      ],
      manualEdit: 'לעריכה — לחץ על שיבוץ קיים. למחיקה — לחץ ❌ ליד השיבוץ.',
      h2Auto: 'שיבוץ אוטומטי',
      autoDesc: 'האלגוריתם מחשב את ההצעה האופטימלית בהתאם לבקשות, הרשאות והגבלות אתר.',
      h3AutoSteps: 'שלבי הפעלה',
      autoSteps: [
        'לחץ על יום בלוח לפתיחת חלון היומי',
        'לחץ "שיבוץ אוטומטי"',
        'המערכת מציגה הצעות שיבוץ + פוזיציות שלא אוישו עם סיבות',
        'אשר הכל / אשר בנפרד / ערוך ידנית / בטל',
      ],
      h3Score: 'אלגוריתם הניקוד (נמוך = עדיף)',
      formula: 'ציון = ציון_העדפה + ציון_עדיפות + עונש_יתר_כישורים + ציון_הוגנות',
      formulaLines: [
        'ציון_העדפה = 0 (מועדף) / 1 (יכול)',
        'ציון_עדיפות = (5 − עדיפות_עובד) × 0.4',
        'עונש_יתר_כישורים = פער_מורכבות × 0.3',
        'ציון_הוגנות = שיבוצים_קודמים × 0.05',
      ],
      h3Unfilled: 'סיבות נפוצות לפוזיציה לא מאויישת',
      unfilledItems: [
        'אין עובד עם הרשאה לסוג הפעילות',
        'כל העובדים המורשים בחופשה',
        'תפקיד העובד אינו ברשימת התפקידים המותרים לאתר',
        'לא הוגשה בקשת משמרת לאותו יום',
      ],
      h3Coverage: 'כיסוי בזמן ישיבת צוות',
      coverageDesc: 'כאשר עובד משובץ לסשן ישיבת צוות וגם לאתר באותה שעה — מופיע תג ⚠ ישיבה על השיבוץ שלו.',
      coverageItems: [
        'לחץ על תג ⚠ ישיבה לפתיחת חלון ניהול כיסוי',
        'המערכת מציעה מחליפים מתאימים (לא בישיבה, מורשים לאתר)',
        'בחר מחליף — הוא יאושר אוטומטית',
        'בפרסום הסידור — המחליף והעובד המקורי מקבלים הודעה',
      ],
    },

    specialDays: {
      nav: 'ימים מיוחדים', h2: 'ימים מיוחדים',
      desc: 'ניהול לוח שנה של חגים ואירועים מיוחדים.',
      steps: [
        'לחץ על תאריך בלוח',
        'הזן שם היום (לדוגמה: "ראש השנה")',
        'בחר סוג: חג / אירוע / אחר',
        'שמור',
      ],
      note: 'ימים מיוחדים מסומנים אוטומטית גם בלוח שיבוצים לחדרים.',
    },

    report: {
      nav: 'דוח חודשי', h2: 'דוח חודשי',
      desc: 'סטטיסטיקת מילוי בקשות לפי סוג משמרת.',
      items: ['לוח חודשי של כל הבקשות', 'מספר עובדים שביקשו מול מספר שישובצו', 'אחוז מילוי לכל סוג משמרת'],
    },

    profileRequests: {
      nav: 'בקשות לאישור', h2: 'בקשות לאישור',
      desc1: 'תור בקשות שינוי פרופיל מעובדים.',
      desc2: 'כל בקשה מציגה: שם העובד, השדה שהשתנה, ערך ישן ← ערך חדש, תאריך.',
      items: ['אשר — השינוי מתעדכן מייד', 'דחה — ניתן להוסיף הסבר לעובד'],
    },

    events: {
      nav: 'אירועים', h2: 'אירועים',
      h3Create: 'יצירת אירוע',
      createSteps: [
        'לחץ "אירוע חדש" ← הזן שם, סוג, תיאור',
        'הוסף מוזמנים מרשימת העובדים',
        'הגדר מפגשים: תאריך, שעות, קיבולת',
      ],
      h3Predict: 'ניבוי מפגש 🔮',
      predictDesc: 'הכנס תאריך + שעות היפותטיות — המערכת מחזירה מי מהמוזמנים יכול להגיע ומי יש לו קונפליקט.',
      h3Optimize: 'אופטימיזציה ⚡',
      optimizeDesc: 'חלוקה אוטומטית מקסימלית של עובדים בין מפגשים. המערכת מדווחת מי שובץ, מי לא ומדוע.',
      h3OptimizeAlgo: 'איך האלגוריתם עובד',
      optimizeAlgoSteps: [
        'לכל מוזמן — מחשבים לכמה סשנים הוא זמין (ללא קונפליקט שיבוצי אתר)',
        'מיון המוזמנים לפי גמישות עולה: מי שיכול ללכת למעט סשנים — מקבל עדיפות',
        'לכל סשן (לפי סדר כרונולוגי) — ממלאים בעובדים הפחות גמישים שיכולים להגיע',
        'כל עובד משובץ לסשן אחד בלבד',
        'מי שזמין רק לסשן אחד לא "ייגנב" לסשן אחר',
      ],
      h3OptimizeLimits: 'מגבלות',
      optimizeLimitItems: [
        'לא מחשב מחדש שיבוצים קיימים',
        'אלגוריתם חמדני — לא ערובה מוחלטת לשיבוץ גלובלי מקסימלי',
      ],
    },

    settings: {
      nav: 'הגדרות מערכת', h2: 'הגדרות מערכת',
      desc: 'נגישות ממנו ⚙️ בתפריט. כוללת 10 לשוניות:',
      colTab: 'לשונית', colDesc: 'תיאור',
      settingsRows: [
        ['תפקידים', 'הוספה/עריכה/מחיקה של תפקידי עובדים'],
        ['סוגי העסקה', 'קטגוריות סוג ההעסקה'],
        ['תארים', 'קידומות שם (ד"ר, פרופ\')'],
        ['קבוצות ואתרים', 'מחלקות, חדרים, הגבלות תפקיד, סימון הוגנות ⚖️'],
        ['סוגי פעילות', 'נהלים עם רמת מורכבות 1–3'],
        ['שעות משמרות', 'שעות ברירת מחדל לכל סוג משמרת'],
        ['נעילת סידור', 'מצב נעילה + חלון חריגה זמני'],
        ['פערי הכשרה', 'ניתוח חוסרים בהרשאות הצוות'],
        ['היררכיה', 'מבנה הרשאות ארגוני (סופר-מנהל)'],
        ['סניפים', 'יצירה/מחיקה של סניפים (סופר-מנהל)'],
      ],
      h3JobRestrict: 'הגבלת תפקידים לאתר',
      jobRestrictDesc: 'בלשונית "קבוצות ואתרים" — לחץ "תפקידים" ליד אתר כדי להגביל אילו תפקידים מותרים בו. האלגוריתם האוטומטי לא ישבץ עובד שתפקידו לא ברשימה.',
      h3LockModes: 'נעילת סידור',
      lockColMode: 'מצב', lockColDesc: 'תיאור',
      lockRows: [
        ['חודשי', 'נועל אוטומטית ביום מסוים בכל חודש'],
        ['שבועי', 'נועל אוטומטית ביום מסוים בכל שבוע'],
        ['חלון חריגה', 'פתיחה זמנית לטווח תאריכים מוגדר'],
      ],
    },

    clusters: {
      nav: 'ניהול אשכולות', h2: 'ניהול אשכולות — רופאים מנתחים',
      desc: 'כרטיסייה לניהול רופאים מנתחים ואשכולות עובדים מועדפים. האשכול משפיע ישירות — הן ויזואלית והן אלגוריתמית — על שיבוץ העובדים לניתוחים.',

      h3What: 'מה זה אשכול?',
      whatDesc: 'אשכול הוא קבוצת עובדים (מרדימים, אחיות, טכנאים) שרופא מנתח מסוים מעדיף לעבוד איתם. המערכת מנצלת רשימה זו כדי לתעדף את אותם עובדים — הן בתצוגה הידנית והן בשיבוץ האוטומטי — כשמשבצים לשורה שנושאת את שמו של אותו רופא.',

      h3SurgeonInShift: 'רופא מנתח כסוג פעילות',
      surgeonInShiftDesc: 'בחלון ניהול המשמרת של חדר, כשמוסיפים שורת פעילות, ניתן לבחור "🔬 רופא מנתח" במקום "סוג פעילות" רגיל. שורה כזו מוצגת בכחול עם שם הרופא. כל שיבוץ עובד לשורה זו מושפע מהאשכול של אותו רופא.',

      h3HowCluster: 'השפעת האשכול — שיבוץ ידני',
      clusterItems: [
        '★ עובדי האשכול מופיעים ראשונים ורמוזים ב-★ ברשימת המועמדים',
        '"אשכול בלבד" — checkbox שמסנן ומציג רק את עובדי האשכול',
        'עובדים מחוץ לאשכול מוצגים בהמשך הרשימה, מופרדים ויזואלית',
      ],

      h3AutoScore: 'השפעת האשכול — שיבוץ אוטומטי',
      autoScoreDesc: 'האלגוריתם מחשב ציון לכל עובד מועמד לכל שורה. ציון נמוך = עדיפות גבוהה. הנוסחה:',
      scoreFormulaRows: [
        ['העדפת משמרת', '0 (מועדף) / 1 (יכול)', 'בסיס לפי בקשת העובד'],
        ['עדיפות פעילות', '(5 − עדיפות) × 0.4', 'לפי הרשאת פעילות (1–5)'],
        ['עודף כישורים', 'פער × 0.3', 'עובד מוכשר מדי לשורה פשוטה — עדיפות נמוכה'],
        ['הוגנות', 'שיבוצים × 0.05', 'מי שעבד פחות — מועדף'],
        ['קנס אשכול', '+1.5 אם לא באשכול', 'עובד מחוץ לאשכול הרופא — קנס כבד'],
      ],
      scoreColFactor: 'גורם', scoreColValue: 'ערך', scoreColNote: 'הסבר',
      autoScoreNote: 'קנס האשכול (1.5) גדול מההפרש בין "מועדף" ל"יכול" (1.0). כלומר: עובד באשכול שביקש "יכול" יועדף על פני עובד מחוץ לאשכול שביקש "מועדף". האשכול חזק יותר מהעדפת המשמרת. אם אין עובדי אשכול זמינים — האלגוריתם ממשיך לשאר העובדים.',

      h3Workflow: 'תהליך עבודה מקצה לקצה',
      workflowItems: [
        'הגדר רופא: כרטיסיית "ניהול אשכולות" ← "הוסף" ← שם + קבוצת פעילות',
        'בנה אשכול: לחץ על שם הרופא ← הוסף עובדים רלוונטיים (מרדימים, אחיות)',
        'שבץ רופא לחדר: "שיבוצים לחדרים" ← לחץ על יום ← פתח חלון חדר ← "הוסף שורה" ← בחר "🔬 רופא מנתח" ← בחר רופא',
        'שבץ עובד ידנית: לחץ "הוסף שיבוץ" בשורת הרופא ← עובדי האשכול מסומנים ★ ומוצגים ראשונים',
        'שיבוץ אוטומטי: לחץ "שיבוץ אוטומטי" ← האלגוריתם מעדיף עובדי אשכול בציון',
      ],

      h3ManageSurgeons: 'ניהול רופאים',
      manageSurgeonsItems: [
        'הוסף רופא: הזן שם ← בחר קבוצת פעילות (אופציונלי) ← לחץ "הוסף"',
        'קבוצת פעילות: לסינון ברשימה בלבד — לא מגבילה שיבוץ',
        'ערוך רופא: לחץ ✏️ ← שנה שם/קבוצה ← לחץ "שמור"',
        'מחק רופא: לחץ 🗑 — קבוע, מוחק גם את האשכול ומנתק שורות קיימות',
        'סינון הרשימה: בחר קבוצת פעילות מהפילטר בראש הרשימה',
      ],

      h3ManageCluster: 'ניהול אשכול',
      manageClusterItems: [
        'לחץ על שם רופא ברשימה — פאנל האשכול נפתח',
        'עובדי האשכול הנוכחיים מוצגים כתגיות כחולות עם לחצן ✕ להסרה',
        'הוסף עובד: סנן לפי תפקיד ← הקלד שם ← לחץ על שמו ברשימה — נוסף מיד',
        'אין מגבלה על גודל האשכול',
        'אותו עובד יכול להופיע באשכולות של מספר רופאים',
      ],

      tip: 'מומלץ לבנות אשכולות לפני תחילת שיבוץ חודשי. ככל שהאשכול גדול יותר — כך לאלגוריתם יש יותר גמישות לבחור מהעובדים המועדפים.',
    },

    workerAvailability: {
      nav: 'זמינות עובדים', h2: 'חלון זמינות עובדים',
      desc: 'חלון זה מסכם את מצב העובדים לתאריך הנבחר. הוא מחולק לארבע קבוצות:',
      groupRows: [
        ['זמינים לפי משמרת', 'עובדים שהגישו בקשת "יכול" או "מעדיף" לתאריך זה — מוצגים לפי סוג המשמרת שביקשו'],
        ['לא משובצים', 'עובדים שביקשו לעבוד אך טרם שובצו לאתר כלשהו. כל עובד מלווה בסיבה: "לא נבחר" (יש אתרים פנויים), "אתרים מלאים" (אין אתרים פנויים), "אין פעילות" (לא הוגדרה פעילות למשמרת)'],
        ['חופשה מאושרת', 'עובדים עם חופשה מאושרת בתאריך זה'],
        ['לא זמינים / לא ביקשו', 'עובדים שסימנו "לא יכול" (מופיעים עם תגית "לא יכול") או שלא הגישו בקשה כלל (תגית "לא ביקש")'],
      ],
    },
  },

  /* ═══════════════════════════════════════════════════ ENGLISH */
  en: {
    title: '📖 User Guide',
    navUser: 'User', navAdmin: 'Admin',
    adminDivider: 'Admin Tabs',
    colSymbol: 'Symbol', colName: 'Name', colDesc: 'Description', colMeaning: 'Meaning',
    colStatus: 'Status', colTab: 'Tab', colColor: 'Color',

    profile: {
      nav: 'My Profile', h2: 'My Profile',
      desc: 'Manage your personal details in the system.',
      h3Edit: 'Edit Personal Details',
      editItems: [
        'Mobile phone, personal email address',
        'Changes require manager approval before taking effect',
        'Pending changes are marked "Awaiting Approval"',
      ],
      h3Photo: 'Profile Photo',
      photoSteps: [
        'Click on the photo circle',
        'Choose "Upload photo" or "Take photo"',
        'Crop the image in the crop window',
        'Click "Save" — photo updates immediately',
      ],
    },

    shifts: {
      nav: 'Shift Requests', h2: 'Shift Requests',
      desc: 'A monthly calendar for managing your shift preferences.',
      h3Types: 'Shift Types',
      shiftRows: [
        ['☀️', 'Morning', 'Regular morning shift'],
        ['🌙', 'Evening', 'Evening shift'],
        ['📞', 'On-Call', 'On-call from home'],
        ['⭐', 'Night Duty', 'Night duty shift'],
      ],
      h3Pref: 'Preference Levels',
      prefRows: [
        ['💚', 'Preferred', 'I want this shift'],
        ['💙', 'Can', 'I am able to work this shift'],
        ['❌', 'Cannot', 'I am not available for this shift'],
      ],
      h3How: 'How to Submit a Request',
      howSteps: [
        'Select the desired month using the navigation arrows',
        'Click on a day + shift cell in the calendar',
        'Click again to cycle through preferences: 💚 → 💙 → ❌ → (empty)',
        'Changes are saved automatically',
      ],
      h3Default: 'Weekly Default Template',
      defaultDesc: 'You can set a repeating pattern for each day of the week — it will apply automatically to future months.',
      h3Lock: 'Lock Mode',
      lockDesc: 'When the schedule is locked, shift requests cannot be changed. The calendar shows a lock message with the expected opening date. A manager can open a temporary "override window".',
      h3Approval: 'Worker Shift Change Approval',
      approvalWorkerItems: [
        'When a manager changes or cancels your shift request, an approval request may be sent to you',
        'You will receive a chat message with the details of the change',
        'Click "✅ Yes, I approve" to accept — the change will be saved',
        'Click "❌ No, I reject" to decline — the request reverts to your original preference',
        'The shift cell displays ⏳ until you respond',
      ],
      approvalAdminItems: [
        'Choose "Yes, send to worker" — a message with approve/reject buttons is sent to the chat',
        'Choose "No, change/cancel myself" — the change is saved and marked as "Admin Modified" with no notification',
        'You can add a personal note that will be attached to the request',
        'You will receive a chat notification as soon as the worker responds',
      ],
    },

    vacations: {
      nav: 'Vacation Requests', h2: 'Vacation Requests',
      h3Submit: 'Submit a Request',
      submitSteps: [
        'Click "New Vacation Request"',
        'Select start date and end date',
        'Add a note (optional)',
        'Click "Submit Request"',
      ],
      h3Status: 'Statuses',
      statusRows: [
        ['Pending', 'Submitted, not yet reviewed'],
        ['Approved', 'Manager approved the request'],
        ['Partial', 'Some dates were approved'],
        ['Rejected', 'Rejected (the manager may have left a note)'],
        ['Cancelled', 'Employee cancelled the request'],
      ],
      h3Cancel: 'Cancel a Request',
      cancelDesc: 'You can only cancel a request in "Pending" status: click the request → "Cancel Request".',
    },

    messages: {
      nav: 'Messages', h2: 'Messages',
      h3Direct: 'Direct Conversations',
      directDesc: 'Click on an employee or manager name to open a conversation. Type a message and press Enter or the send button.',
      h3Content: 'Content Types',
      contentItems: ['Free text', 'Images (JPG, PNG)', 'Documents (PDF, Word)', 'Videos', 'Links — automatic preview is displayed'],
      h3Badge: 'Unread Message Badge',
      badgeDesc: 'The messages icon (💬) in the menu shows a count of unread messages.',
      h3ShiftApproval: 'Shift Change Approvals',
      shiftApprovalItems: [
        'When a manager sends a shift-change approval request, it appears as a special highlighted message',
        'Click "✅ Yes, I approve" or "❌ No, I reject" directly in the chat',
        'Once responded, the buttons are replaced by a status label (Approved / Rejected)',
        'The admin receives an automatic notification message with your response',
      ],
    },

    workers: {
      nav: 'Worker Management', h2: 'Worker Management',
      h3List: 'Worker List',
      listItems: [
        'Search by name or ID number',
        'Filter by job, employment type, active/inactive',
        'Sort by any column',
        'Print & export: select fields → click "Print"',
      ],
      h3Add: 'Add New Worker — 4 Tabs',
      addColTab: 'Tab', addColFields: 'Key Fields',
      addRows: [
        ['Personal Details', 'Title, name, ID, phone, photo'],
        ['Organizational Details', 'Job, employment type, org email, classification'],
        ['Branch Assignments', 'Primary branch, secondary branches (super-admin)'],
        ['Activity Authorizations', 'Available after saving the worker'],
      ],
      h3Auth: 'Activity Authorizations',
      authSteps: [
        'Open a worker → "Activity Authorizations" tab',
        'Click "Add Authorization"',
        'Select an activity type',
        'Set priority (1–5) — 5 = highest priority in auto-assignment',
      ],
      tip: 'The ID number becomes the login username. Creating a worker automatically creates a user account.',
    },

    rooms: {
      nav: 'Room Assignments', nav_manual: '↳ Manual Assignment', nav_auto: '↳ Auto Assignment',
      h2: 'Room Assignments',
      desc: 'The central tab for managing daily assignments. Displays a monthly calendar where each cell is one day.',
      h3Colors: 'Calendar Status Colors',
      colorRows: [
        ['Green', 'Worker submitted a "Preferred" request'],
        ['Blue', 'Worker submitted a "Can" request'],
        ['Gray', 'No request submitted'],
        ['Red/Orange', 'Worker is on vacation'],
      ],
      h2Manual: 'Manual Assignment',
      manualSteps: [
        'Select month using navigation arrows',
        'Click a day cell — a daily panel opens (draggable)',
        'Find a site in the list → click "Add Assignment"',
        'Select a worker — green = "Preferred", blue = "Can"',
        'Select activity type and shift type',
        'Click "Save"',
      ],
      manualEdit: 'To edit — click an existing assignment. To delete — click ❌ next to it.',
      h2Auto: 'Auto Assignment',
      autoDesc: 'The algorithm calculates the optimal suggestion based on requests, authorizations, and site restrictions.',
      h3AutoSteps: 'Steps to Run',
      autoSteps: [
        'Click a day in the calendar to open the daily panel',
        'Click "Auto Assignment"',
        'The system shows assignment suggestions + unfilled positions with reasons',
        'Approve all / approve individually / edit manually / cancel',
      ],
      h3Score: 'Scoring Algorithm (lower = better)',
      formula: 'score = pref_score + priority_score + overqualification_penalty + fairness_score',
      formulaLines: [
        'pref_score = 0 (preferred) / 1 (can)',
        'priority_score = (5 − worker_priority) × 0.4',
        'overqualification_penalty = complexity_gap × 0.3',
        'fairness_score = previous_assignments × 0.05',
      ],
      h3Unfilled: 'Common Reasons a Position is Unfilled',
      unfilledItems: [
        'No worker authorized for this activity type',
        'All authorized workers are on vacation',
        'Worker\'s job is not in the site\'s allowed-job list',
        'No shift request was submitted for that day',
      ],
      h3Coverage: 'Coverage During Team Meetings',
      coverageDesc: 'When a worker is assigned to a team meeting session and also to a site at the same time, a ⚠ Meeting badge appears on their assignment.',
      coverageItems: [
        'Click the ⚠ Meeting badge to open the coverage management window',
        'The system suggests suitable replacements (not in meeting, authorized for site)',
        'Select a replacement — they are approved automatically',
        'When the schedule is published — both the replacement and original worker receive a notification',
      ],
    },

    specialDays: {
      nav: 'Special Days', h2: 'Special Days',
      desc: 'Manage a calendar of holidays and special events.',
      steps: [
        'Click on a date in the calendar',
        'Enter the day\'s name (e.g., "New Year")',
        'Select type: Holiday / Event / Other',
        'Save',
      ],
      note: 'Special days are automatically highlighted in the Room Assignments calendar.',
    },

    report: {
      nav: 'Monthly Report', h2: 'Monthly Report',
      desc: 'Request-fulfillment statistics by shift type.',
      items: ['Monthly calendar of all requests', 'Number of workers who requested vs. assigned', 'Fulfillment percentage per shift type'],
    },

    profileRequests: {
      nav: 'Approval Requests', h2: 'Approval Requests',
      desc1: 'Queue of profile-change requests from workers.',
      desc2: 'Each request shows: worker name, changed field, old value → new value, date.',
      items: ['Approve — change is applied immediately', 'Reject — you can add a note to the worker'],
    },

    events: {
      nav: 'Events', h2: 'Events',
      h3Create: 'Create an Event',
      createSteps: [
        'Click "New Event" → enter name, type, description',
        'Add invitees from the worker list',
        'Define sessions: date, times, capacity',
      ],
      h3Predict: 'Predict Session 🔮',
      predictDesc: 'Enter a hypothetical date + times — the system returns who among the invitees can attend and who has a conflict.',
      h3Optimize: 'Optimization ⚡',
      optimizeDesc: 'Automatically maximize worker distribution across sessions. The system reports who was assigned, who was not, and why.',
      h3OptimizeAlgo: 'How the Algorithm Works',
      optimizeAlgoSteps: [
        'For each invitee — compute how many sessions they can attend (no site assignment conflict)',
        'Sort invitees by flexibility ascending: those who can attend fewer sessions get priority',
        'For each session (chronologically) — fill with the least-flexible eligible workers first',
        'Each worker is assigned to at most one session',
        'Workers available only for one session are never "stolen" by an earlier session',
      ],
      h3OptimizeLimits: 'Limitations',
      optimizeLimitItems: [
        'Does not recalculate existing assignments',
        'Greedy algorithm — not an absolute guarantee of the global maximum assignment',
      ],
    },

    settings: {
      nav: 'System Settings', h2: 'System Settings',
      desc: 'Accessible from the ⚙️ menu. Contains 10 tabs:',
      colTab: 'Tab', colDesc: 'Description',
      settingsRows: [
        ['Jobs', 'Add / edit / delete worker job titles'],
        ['Employment Types', 'Employment category definitions'],
        ['Honorifics', 'Name prefixes (Dr., Prof.)'],
        ['Groups & Sites', 'Departments, rooms, job restrictions, fairness flag ⚖️'],
        ['Activity Types', 'Procedures with complexity level 1–3'],
        ['Shift Hours', 'Default start/end times per shift type'],
        ['Schedule Lock', 'Lock mode + temporary override window'],
        ['Training Gaps', 'Analysis of missing authorizations in the team'],
        ['Hierarchy', 'Organizational permission structure (super-admin)'],
        ['Branches', 'Create / delete branches (super-admin)'],
      ],
      h3JobRestrict: 'Site Job Restrictions',
      jobRestrictDesc: 'In the "Groups & Sites" tab — click "Jobs" next to a site to restrict which job titles are allowed. The auto-assignment algorithm will not assign a worker whose job is not on the list.',
      h3LockModes: 'Schedule Lock',
      lockColMode: 'Mode', lockColDesc: 'Description',
      lockRows: [
        ['Monthly', 'Locks automatically on a specified day each month'],
        ['Weekly', 'Locks automatically on a specified day each week'],
        ['Override Window', 'Temporary unlock for a defined date range'],
      ],
    },

    clusters: {
      nav: 'Cluster Management', h2: 'Cluster Management — Surgeons',
      desc: 'A tab for managing surgeons and their preferred worker clusters. The cluster affects assignment both visually (manual) and algorithmically (auto-assignment).',

      h3What: 'What is a Cluster?',
      whatDesc: 'A cluster is a list of workers (anesthesiologists, nurses, technicians) that a specific surgeon prefers to work with. The system uses this list to prioritize those workers — both in the manual candidate view and in the auto-assignment algorithm — whenever a shift row is linked to that surgeon.',

      h3SurgeonInShift: 'Surgeon as Activity Type',
      surgeonInShiftDesc: 'In the shift management window, when adding an activity row, you can choose "🔬 Surgeon" instead of a standard activity type. The row is displayed in blue with the surgeon\'s name. Every worker assigned to that row is influenced by the surgeon\'s cluster.',

      h3HowCluster: 'Cluster Effect — Manual Assignment',
      clusterItems: [
        '★ Cluster workers appear first in the candidate list, marked with ★',
        '"Cluster Only" checkbox — filters to show only cluster workers',
        'Workers outside the cluster are shown below, visually separated',
      ],

      h3AutoScore: 'Cluster Effect — Auto Assignment',
      autoScoreDesc: 'The algorithm computes a score for each candidate worker per slot. Lower score = higher priority. The formula:',
      scoreFormulaRows: [
        ['Shift preference', '0 (preferred) / 1 (can)', 'Based on the worker\'s shift request'],
        ['Activity priority', '(5 − priority) × 0.4', 'From activity authorization (1–5)'],
        ['Overqualification', 'gap × 0.3', 'Over-skilled for a simple slot — lower priority'],
        ['Fairness', 'assignments × 0.05', 'Less-assigned workers get a slight edge'],
        ['Cluster penalty', '+1.5 if not in cluster', 'Worker outside the surgeon\'s cluster — heavy penalty'],
      ],
      scoreColFactor: 'Factor', scoreColValue: 'Value', scoreColNote: 'Note',
      autoScoreNote: 'The cluster penalty (1.5) is larger than the "preferred vs can" gap (1.0). This means a cluster worker who requested "can" outscores a non-cluster worker who requested "preferred". The cluster preference overrides shift preference. If no cluster workers are available, the algorithm falls back to all eligible workers.',

      h3Workflow: 'End-to-End Workflow',
      workflowItems: [
        'Create surgeon: "Cluster Management" tab → "Add" → name + activity group',
        'Build cluster: click the surgeon\'s name → add relevant workers (anesthesiologists, nurses)',
        'Assign surgeon to room: "Room Assignments" → click a day → open room panel → "Add Row" → choose "🔬 Surgeon" → select surgeon',
        'Manual assignment: click "Add Assignment" on the surgeon row → cluster workers are marked ★ and listed first',
        'Auto-assignment: click "Auto Assignment" → the algorithm scores cluster workers lower (better) for surgeon rows',
      ],

      h3ManageSurgeons: 'Managing Surgeons',
      manageSurgeonsItems: [
        'Add surgeon: enter name → select activity group (optional) → click "Add"',
        'Activity group: for list filtering only — does not restrict assignments',
        'Edit surgeon: click ✏️ → change name/group → click "Save"',
        'Delete surgeon: click 🗑 — permanent, removes the cluster and disconnects existing rows',
        'Filter the list: select an activity group from the filter at the top',
      ],

      h3ManageCluster: 'Managing a Cluster',
      manageClusterItems: [
        'Click a surgeon\'s name — the cluster panel opens on the right',
        'Current cluster workers appear as blue tags with a ✕ remove button',
        'Add worker: filter by job → type name in search → click the worker\'s name — added immediately',
        'No limit on cluster size',
        'The same worker can appear in multiple surgeons\' clusters',
      ],

      tip: 'Build clusters before the monthly scheduling cycle. The larger the cluster, the more flexibility the algorithm has to find an available preferred worker.',
    },

    workerAvailability: {
      nav: 'Worker Availability', h2: 'Worker Availability Window',
      desc: 'This window summarises worker status for the selected date. It is divided into four groups:',
      groupRows: [
        ['Available by shift', 'Workers who submitted a "can" or "prefer" request for this date — shown by the shift they requested'],
        ['Unassigned', 'Workers who requested to work but have not yet been assigned to any site. Each worker shows a reason: "Not selected" (open slots exist), "Sites full" (no open slots), "No activity" (no activity configured for the shift)'],
        ['Approved vacation', 'Workers with an approved vacation on this date'],
        ['Unavailable / No request', 'Workers who marked "cannot" (shown with a "Cannot" badge) or submitted no request at all (badge: "No request")'],
      ],
    },
  },

  /* ═══════════════════════════════════════════════════ ARABIC */
  ar: {
    title: '📖 دليل المستخدم',
    navUser: 'المستخدم', navAdmin: 'المدير',
    adminDivider: 'تبويبات المدير',
    colSymbol: 'رمز', colName: 'اسم', colDesc: 'وصف', colMeaning: 'معنى',
    colStatus: 'الحالة', colTab: 'تبويب', colColor: 'لون',

    profile: {
      nav: 'ملفي الشخصي', h2: 'ملفي الشخصي',
      desc: 'إدارة بياناتك الشخصية في النظام.',
      h3Edit: 'تعديل البيانات الشخصية',
      editItems: [
        'رقم الهاتف المحمول، البريد الإلكتروني الشخصي',
        'تتطلب التغييرات موافقة المدير قبل تطبيقها',
        'الطلبات المعلقة تُعلَّم بـ "في انتظار الموافقة"',
      ],
      h3Photo: 'صورة الملف الشخصي',
      photoSteps: [
        'انقر على دائرة الصورة',
        'اختر "رفع صورة" أو "التقاط صورة"',
        'قص الصورة في نافذة القص',
        'انقر "حفظ" — تُحدَّث الصورة فوراً',
      ],
    },

    shifts: {
      nav: 'طلبات الوردية', h2: 'طلبات الوردية',
      desc: 'تقويم شهري لإدارة تفضيلات الورديات.',
      h3Types: 'أنواع الورديات',
      shiftRows: [
        ['☀️', 'صباح', 'وردية صباح عادية'],
        ['🌙', 'مساء', 'وردية مساء'],
        ['📞', 'استعداد', 'استعداد من المنزل'],
        ['⭐', 'مناوبة', 'مناوبة ليلية'],
      ],
      h3Pref: 'مستويات التفضيل',
      prefRows: [
        ['💚', 'مفضّل', 'أرغب في هذه الوردية'],
        ['💙', 'أستطيع', 'قادر على العمل في هذه الوردية'],
        ['❌', 'لا أستطيع', 'غير متاح لهذه الوردية'],
      ],
      h3How: 'كيفية تقديم الطلب',
      howSteps: [
        'اختر الشهر المطلوب باستخدام أسهم التنقل',
        'انقر على خلية يوم + وردية في التقويم',
        'انقر مرة أخرى للتنقل بين التفضيلات: 💚 → 💙 → ❌ → (فارغ)',
        'تُحفظ التغييرات تلقائياً',
      ],
      h3Default: 'قالب أسبوعي افتراضي',
      defaultDesc: 'يمكنك تعيين نمط متكرر لكل يوم من أيام الأسبوع — سيُطبَّق تلقائياً على الأشهر القادمة.',
      h3Lock: 'وضع القفل',
      lockDesc: 'عند قفل الجدول لا يمكن تعديل الطلبات. يعرض التقويم رسالة قفل مع تاريخ الفتح المتوقع. يستطيع المدير فتح "نافذة استثناء" مؤقتة.',
      h3Approval: 'موافقة الموظف على التغييرات',
      approvalWorkerItems: [
        'عندما يغيّر المدير أو يلغي طلب وردية خاصاً بك، قد تُرسَل إليك طلب موافقة',
        'ستصلك رسالة دردشة تتضمن تفاصيل التغيير',
        'انقر "✅ نعم، أوافق" للقبول — سيُحفظ التغيير',
        'انقر "❌ لا، أرفض" للرفض — يعود الطلب إلى تفضيلك الأصلي',
        'تعرض خلية الوردية ⏳ حتى تُجيب',
      ],
      approvalAdminItems: [
        'اختر "نعم، أرسل للموظف" — تُرسَل رسالة بأزرار موافقة/رفض إلى الدردشة',
        'اختر "لا، غيّر/ألغِ بنفسي" — يُحفظ التغيير ويُعلَّم كـ"تعديل مدير" دون إشعار',
        'يمكنك إضافة ملاحظة شخصية تُرفق بالطلب',
        'ستصلك إشعار دردشة فور رد الموظف',
      ],
    },

    vacations: {
      nav: 'طلبات الإجازة', h2: 'طلبات الإجازة',
      h3Submit: 'تقديم طلب',
      submitSteps: [
        'انقر "طلب إجازة جديد"',
        'اختر تاريخ البداية وتاريخ النهاية',
        'أضف ملاحظة (اختياري)',
        'انقر "إرسال الطلب"',
      ],
      h3Status: 'الحالات',
      statusRows: [
        ['معلّق', 'قُدِّم، لم يُراجَع بعد'],
        ['موافق عليه', 'وافق المدير على الطلب'],
        ['جزئي', 'بعض التواريخ موافق عليها'],
        ['مرفوض', 'رُفض (قد يوجد تعليق من المدير)'],
        ['ملغى', 'ألغى الموظف الطلب'],
      ],
      h3Cancel: 'إلغاء الطلب',
      cancelDesc: 'يمكن إلغاء طلب في حالة "معلّق" فقط: انقر على الطلب ← "إلغاء الطلب".',
    },

    messages: {
      nav: 'الرسائل', h2: 'الرسائل',
      h3Direct: 'المحادثات المباشرة',
      directDesc: 'انقر على اسم موظف أو مدير في القائمة لفتح محادثة. اكتب رسالة واضغط Enter أو زر الإرسال.',
      h3Content: 'أنواع المحتوى',
      contentItems: ['نص حر', 'صور (JPG, PNG)', 'مستندات (PDF, Word)', 'مقاطع فيديو', 'روابط — تُعرض معاينة تلقائية'],
      h3Badge: 'شارة الرسائل غير المقروءة',
      badgeDesc: 'تعرض أيقونة الرسائل (💬) في القائمة عدد الرسائل غير المقروءة.',
      h3ShiftApproval: 'موافقات تغيير الوردية',
      shiftApprovalItems: [
        'عندما يُرسل المدير طلب موافقة على تغيير وردية، يظهر كرسالة مميزة مظللة',
        'انقر "✅ نعم، أوافق" أو "❌ لا، أرفض" مباشرةً في الدردشة',
        'بعد الرد، تُستبدل الأزرار بتسمية الحالة (تمت الموافقة / مرفوض)',
        'يتلقى المدير رسالة تلقائية بردك',
      ],
    },

    workers: {
      nav: 'إدارة الموظفين', h2: 'إدارة الموظفين',
      h3List: 'قائمة الموظفين',
      listItems: [
        'البحث بالاسم أو رقم الهوية',
        'تصفية حسب الوظيفة، نوع التوظيف، نشط/غير نشط',
        'ترتيب حسب أي عمود',
        'طباعة وتصدير: اختر الحقول ← انقر "طباعة"',
      ],
      h3Add: 'إضافة موظف جديد — 4 تبويبات',
      addColTab: 'التبويب', addColFields: 'الحقول الرئيسية',
      addRows: [
        ['بيانات شخصية', 'لقب، اسم، هوية، هاتف، صورة'],
        ['بيانات تنظيمية', 'وظيفة، نوع التوظيف، البريد المؤسسي، التصنيف'],
        ['إسناد الفروع', 'الفرع الرئيسي، الفروع الثانوية (المدير الأعلى)'],
        ['صلاحيات الأنشطة', 'متاح بعد حفظ الموظف'],
      ],
      h3Auth: 'صلاحيات الأنشطة',
      authSteps: [
        'افتح الموظف ← تبويب "صلاحيات الأنشطة"',
        'انقر "إضافة صلاحية"',
        'اختر نوع النشاط',
        'حدد الأولوية (1–5) — 5 = أعلى أولوية في التعيين التلقائي',
      ],
      tip: 'رقم الهوية يصبح اسم المستخدم لتسجيل الدخول. إنشاء موظف يُنشئ حساباً تلقائياً.',
    },

    rooms: {
      nav: 'جدول الغرف', nav_manual: '↳ تعيين يدوي', nav_auto: '↳ تعيين تلقائي',
      h2: 'جدول الغرف',
      desc: 'التبويب المركزي لإدارة التعيينات اليومية. يعرض تقويماً شهرياً حيث كل خلية يوم.',
      h3Colors: 'ألوان الحالة في التقويم',
      colorRows: [
        ['أخضر', 'قدّم الموظف طلب "مفضّل"'],
        ['أزرق', 'قدّم الموظف طلب "أستطيع"'],
        ['رمادي', 'لم يقدم أي طلب'],
        ['أحمر/برتقالي', 'الموظف في إجازة'],
      ],
      h2Manual: 'التعيين اليدوي',
      manualSteps: [
        'اختر الشهر باستخدام أسهم التنقل',
        'انقر على خلية يوم — تُفتح لوحة يومية (قابلة للسحب)',
        'ابحث عن موقع في القائمة ← انقر "إضافة تعيين"',
        'اختر الموظف — أخضر = "مفضّل"، أزرق = "أستطيع"',
        'اختر نوع النشاط ونوع الوردية',
        'انقر "حفظ"',
      ],
      manualEdit: 'للتعديل — انقر على تعيين موجود. للحذف — انقر ❌ بجانبه.',
      h2Auto: 'التعيين التلقائي',
      autoDesc: 'يحسب الخوارزمية الاقتراح الأمثل بناءً على الطلبات والصلاحيات وقيود الموقع.',
      h3AutoSteps: 'خطوات التشغيل',
      autoSteps: [
        'انقر على يوم في التقويم لفتح اللوحة اليومية',
        'انقر "تعيين تلقائي"',
        'يعرض النظام مقترحات التعيين + المناصب غير المشغولة مع الأسباب',
        'وافق على الكل / وافق بشكل منفرد / عدّل يدوياً / ألغِ',
      ],
      h3Score: 'خوارزمية التقييم (أقل = أفضل)',
      formula: 'النقاط = نقاط_التفضيل + نقاط_الأولوية + عقوبة_فائض_المؤهلات + نقاط_العدالة',
      formulaLines: [
        'نقاط_التفضيل = 0 (مفضّل) / 1 (أستطيع)',
        'نقاط_الأولوية = (5 − أولوية_الموظف) × 0.4',
        'عقوبة_فائض_المؤهلات = فجوة_التعقيد × 0.3',
        'نقاط_العدالة = التعيينات_السابقة × 0.05',
      ],
      h3Unfilled: 'أسباب شائعة لمنصب غير مشغول',
      unfilledItems: [
        'لا يوجد موظف مصرّح له بهذا النوع من النشاط',
        'جميع الموظفين المصرّح لهم في إجازة',
        'وظيفة الموظف ليست ضمن الوظائف المسموح بها للموقع',
        'لم يقدم الموظف طلب وردية لذلك اليوم',
      ],
      h3Coverage: 'التغطية أثناء اجتماعات الفريق',
      coverageDesc: 'عندما يُعيَّن موظف لجلسة اجتماع فريق وأيضاً لموقع في نفس الوقت — تظهر شارة ⚠ اجتماع على تعيينه.',
      coverageItems: [
        'انقر على شارة ⚠ اجتماع لفتح نافذة إدارة التغطية',
        'يقترح النظام بدائل مناسبة (ليسوا في الاجتماع، مصرّح لهم للموقع)',
        'اختر بديلاً — يتم الموافقة عليه تلقائياً',
        'عند نشر الجدول — يتلقى كلا الطرفين إشعاراً',
      ],
    },

    specialDays: {
      nav: 'الأيام الخاصة', h2: 'الأيام الخاصة',
      desc: 'إدارة تقويم العطل والأحداث الخاصة.',
      steps: [
        'انقر على تاريخ في التقويم',
        'أدخل اسم اليوم (مثال: "رأس السنة")',
        'اختر النوع: عطلة / حدث / أخرى',
        'احفظ',
      ],
      note: 'تُعلَّم الأيام الخاصة تلقائياً في تقويم جدول الغرف.',
    },

    report: {
      nav: 'التقرير الشهري', h2: 'التقرير الشهري',
      desc: 'إحصاءات تنفيذ الطلبات حسب نوع الوردية.',
      items: ['تقويم شهري لجميع الطلبات', 'عدد الموظفين الذين طلبوا مقابل المعيّنين', 'نسبة التنفيذ لكل نوع وردية'],
    },

    profileRequests: {
      nav: 'طلبات الموافقة', h2: 'طلبات الموافقة',
      desc1: 'قائمة انتظار طلبات تغيير الملف الشخصي من الموظفين.',
      desc2: 'يعرض كل طلب: اسم الموظف، الحقل المُغيَّر، القيمة القديمة ← الجديدة، التاريخ.',
      items: ['موافقة — يُطبَّق التغيير فوراً', 'رفض — يمكن إضافة ملاحظة للموظف'],
    },

    events: {
      nav: 'الفعاليات', h2: 'الفعاليات',
      h3Create: 'إنشاء فعالية',
      createSteps: [
        'انقر "فعالية جديدة" ← أدخل الاسم والنوع والوصف',
        'أضف المدعوّين من قائمة الموظفين',
        'حدد الجلسات: التاريخ، الأوقات، السعة',
      ],
      h3Predict: 'توقع جلسة 🔮',
      predictDesc: 'أدخل تاريخاً + أوقات افتراضية — يُعيد النظام قائمة بمن يستطيع الحضور ومن لديه تعارض.',
      h3Optimize: 'تحسين تلقائي ⚡',
      optimizeDesc: 'توزيع تلقائي أقصى للموظفين على الجلسات. يُبلّغ النظام عن المعيّنين وغير المعيّنين والأسباب.',
      h3OptimizeAlgo: 'كيف يعمل الخوارزمي',
      optimizeAlgoSteps: [
        'لكل مدعو — يُحسب عدد الجلسات التي يمكنه حضورها (بلا تعارض مع مواقع العمل)',
        'ترتيب المدعوّين تصاعدياً حسب المرونة: من يمكنه حضور جلسات أقل يحصل على الأولوية',
        'لكل جلسة (بترتيب زمني) — تُملأ بالعمال الأقل مرونة المؤهلين للحضور',
        'كل عامل يُعيَّن إلى جلسة واحدة فقط',
        'من لا يتوفر إلا لجلسة واحدة لن يُسرق من جلسة أخرى',
      ],
      h3OptimizeLimits: 'القيود',
      optimizeLimitItems: [
        'لا يعيد حساب التعيينات الموجودة',
        'خوارزمي جشع — لا يضمن ضماناً مطلقاً الحد الأقصى العالمي للتعيينات',
      ],
    },

    settings: {
      nav: 'إعدادات النظام', h2: 'إعدادات النظام',
      desc: 'متاحة من قائمة ⚙️. تحتوي على 10 تبويبات:',
      colTab: 'التبويب', colDesc: 'الوصف',
      settingsRows: [
        ['الوظائف', 'إضافة / تعديل / حذف المسميات الوظيفية'],
        ['أنواع التوظيف', 'تعريفات فئات التوظيف'],
        ['الألقاب', 'بادئات الأسماء (د., أ.)'],
        ['المجموعات والمواقع', 'أقسام، غرف، قيود الوظائف، علامة العدالة ⚖️'],
        ['أنواع الأنشطة', 'إجراءات بمستوى تعقيد 1–3'],
        ['ساعات الورديات', 'أوقات البداية/النهاية الافتراضية لكل نوع وردية'],
        ['قفل الجدول', 'وضع القفل + نافذة استثناء مؤقتة'],
        ['فجوات التدريب', 'تحليل الصلاحيات المفقودة في الفريق'],
        ['التسلسل الهرمي', 'هيكل الصلاحيات التنظيمية (المدير الأعلى)'],
        ['الفروع', 'إنشاء / حذف الفروع (المدير الأعلى)'],
      ],
      h3JobRestrict: 'قيود وظائف الموقع',
      jobRestrictDesc: 'في تبويب "المجموعات والمواقع" — انقر "وظائف" بجانب موقع لتقييد المسميات المسموح بها. لن يُعيّن الخوارزمي موظفاً وظيفته ليست في القائمة.',
      h3LockModes: 'قفل الجدول',
      lockColMode: 'الوضع', lockColDesc: 'الوصف',
      lockRows: [
        ['شهري', 'يُقفل تلقائياً في يوم محدد من كل شهر'],
        ['أسبوعي', 'يُقفل تلقائياً في يوم محدد من كل أسبوع'],
        ['نافذة استثناء', 'فتح مؤقت لنطاق تواريخ محدد'],
      ],
    },

    clusters: {
      nav: 'إدارة الكتلة', h2: 'إدارة الكتلة — الجراحون',
      desc: 'تبويب لإدارة الجراحين وكتل الموظفين المفضلين. تؤثر الكتلة على التكليف بصرياً (يدوي) وخوارزمياً (تلقائي).',

      h3What: 'ما هي الكتلة؟',
      whatDesc: 'الكتلة هي قائمة موظفين (مخدّرين، ممرضات، فنيين) يفضّل جراح معين العمل معهم. يستخدم النظام هذه القائمة لتقديم هؤلاء الموظفين — في العرض اليدوي وفي خوارزمية التكليف التلقائي — عند تكليف موظف لصف يحمل اسم ذلك الجراح.',

      h3SurgeonInShift: 'الجراح كنوع نشاط',
      surgeonInShiftDesc: 'في نافذة إدارة الوردية، عند إضافة صف نشاط، يمكن اختيار "🔬 جراح" بدلاً من نوع نشاط عادي. يُعرض الصف باللون الأزرق مع اسم الجراح. كل تكليف موظف لهذا الصف يتأثر بكتلة ذلك الجراح.',

      h3HowCluster: 'تأثير الكتلة — التكليف اليدوي',
      clusterItems: [
        '★ يظهر موظفو الكتلة أولاً في قائمة المرشحين، مميزين بـ ★',
        'خيار "الكتلة فقط" — يصفّي ويعرض موظفي الكتلة حصراً',
        'يظهر الموظفون خارج الكتلة في أسفل القائمة، مفصولين بصرياً',
      ],

      h3AutoScore: 'تأثير الكتلة — التكليف التلقائي',
      autoScoreDesc: 'تحسب الخوارزمية درجة لكل موظف مرشح لكل صف. الدرجة الأدنى = الأولوية الأعلى. المعادلة:',
      scoreFormulaRows: [
        ['تفضيل الوردية', '0 (مفضّل) / 1 (قادر)', 'بناءً على طلب الموظف'],
        ['أولوية النشاط', '(5 − الأولوية) × 0.4', 'من تفويض النشاط (1–5)'],
        ['فائض المهارة', 'الفجوة × 0.3', 'موظف مؤهل أكثر من اللازم — أولوية أقل'],
        ['العدالة', 'التكليفات × 0.05', 'الأقل تكليفاً يحظى بميزة طفيفة'],
        ['غرامة الكتلة', '+1.5 إن لم يكن في الكتلة', 'موظف خارج كتلة الجراح — غرامة ثقيلة'],
      ],
      scoreColFactor: 'العامل', scoreColValue: 'القيمة', scoreColNote: 'ملاحظة',
      autoScoreNote: 'غرامة الكتلة (1.5) أكبر من الفجوة بين "مفضّل" و"قادر" (1.0). أي أن موظف الكتلة الذي طلب "قادر" يتفوق على موظف خارج الكتلة طلب "مفضّل". تفضيل الكتلة يتجاوز تفضيل الوردية. إذا لم يكن أي موظف من الكتلة متاحاً، تنتقل الخوارزمية للموظفين الآخرين المؤهلين.',

      h3Workflow: 'سير العمل من البداية إلى النهاية',
      workflowItems: [
        'إنشاء جراح: تبويب "إدارة الكتلة" ← "إضافة" ← الاسم + مجموعة النشاط',
        'بناء الكتلة: انقر على اسم الجراح ← أضف الموظفين المعنيين',
        'تعيين جراح للغرفة: "تكليفات الغرف" ← انقر يوماً ← افتح لوحة الغرفة ← "إضافة صف" ← اختر "🔬 جراح" ← اختر الجراح',
        'التكليف اليدوي: انقر "إضافة تكليف" في صف الجراح ← موظفو الكتلة مميزون بـ ★ ويظهرون أولاً',
        'التكليف التلقائي: انقر "تكليف تلقائي" ← الخوارزمية تمنح موظفي الكتلة درجة أفضل',
      ],

      h3ManageSurgeons: 'إدارة الجراحين',
      manageSurgeonsItems: [
        'إضافة جراح: أدخل الاسم ← اختر مجموعة النشاط (اختياري) ← انقر "إضافة"',
        'مجموعة النشاط: للتصفية في القائمة فقط — لا تقيّد التكليف',
        'تعديل جراح: انقر ✏️ ← غيّر الاسم/المجموعة ← انقر "حفظ"',
        'حذف جراح: انقر 🗑 — نهائي، يزيل الكتلة ويقطع الصفوف الموجودة',
        'تصفية القائمة: اختر مجموعة نشاط من الفلتر أعلى القائمة',
      ],

      h3ManageCluster: 'إدارة الكتلة',
      manageClusterItems: [
        'انقر على اسم الجراح — تفتح لوحة الكتلة',
        'يظهر موظفو الكتلة الحاليون كبطاقات زرقاء مع زر ✕ للإزالة',
        'إضافة موظف: صفّ حسب الوظيفة ← اكتب الاسم ← انقر على الاسم — يُضاف فوراً',
        'لا حدّ لحجم الكتلة',
        'يمكن أن يظهر نفس الموظف في كتل جراحين متعددين',
      ],

      tip: 'يُنصح ببناء الكتل قبل بدء دورة الجدولة الشهرية. كلما كانت الكتلة أكبر، زادت مرونة الخوارزمية في اختيار موظف مفضّل متاح.',
    },

    workerAvailability: {
      nav: 'توفر الموظفين', h2: 'نافذة توفر الموظفين',
      desc: 'تلخّص هذه النافذة حالة الموظفين للتاريخ المحدد. وهي مقسّمة إلى أربع مجموعات:',
      groupRows: [
        ['المتاحون حسب الوردية', 'الموظفون الذين قدّموا طلب "يستطيع" أو "يفضّل" لهذا التاريخ — يُعرضون حسب نوع الوردية المطلوبة'],
        ['غير مُعيَّنين', 'الموظفون الذين طلبوا العمل ولم يُعيَّنوا بعد في أي موقع. يظهر مع كل موظف سبب: "غير مُختار" (توجد فتحات مفتوحة)، "المواقع ممتلئة" (لا فتحات)، "لا نشاط" (لم يُحدَّد أي نشاط للوردية)'],
        ['إجازة معتمدة', 'الموظفون الذين لديهم إجازة معتمدة في هذا التاريخ'],
        ['غير متوفرين / لم يطلبوا', 'الموظفون الذين حددوا "لا يستطيع" (يظهرون بشارة "لا يستطيع") أو لم يقدّموا أي طلب (شارة "لم يطلب")'],
      ],
    },
  },

  /* ═══════════════════════════════════════════════════ SPANISH */
  es: {
    title: '📖 Guía del Usuario',
    navUser: 'Usuario', navAdmin: 'Administrador',
    adminDivider: 'Pestañas de Administrador',
    colSymbol: 'Símbolo', colName: 'Nombre', colDesc: 'Descripción', colMeaning: 'Significado',
    colStatus: 'Estado', colTab: 'Pestaña', colColor: 'Color',

    profile: {
      nav: 'Mi Perfil', h2: 'Mi Perfil',
      desc: 'Gestiona tus datos personales en el sistema.',
      h3Edit: 'Editar Datos Personales',
      editItems: [
        'Teléfono móvil, correo electrónico personal',
        'Los cambios requieren aprobación del gerente antes de aplicarse',
        'Los cambios pendientes se marcan como "Pendiente de aprobación"',
      ],
      h3Photo: 'Foto de Perfil',
      photoSteps: [
        'Haz clic en el círculo de la foto',
        'Elige "Subir foto" o "Tomar foto"',
        'Recorta la imagen en la ventana de recorte',
        'Haz clic en "Guardar" — la foto se actualiza de inmediato',
      ],
    },

    shifts: {
      nav: 'Solicitudes de Turno', h2: 'Solicitudes de Turno',
      desc: 'Calendario mensual para gestionar tus preferencias de turno.',
      h3Types: 'Tipos de Turno',
      shiftRows: [
        ['☀️', 'Mañana', 'Turno de mañana regular'],
        ['🌙', 'Tarde', 'Turno de tarde'],
        ['📞', 'Guardia', 'Guardia desde casa'],
        ['⭐', 'Nocturno', 'Turno de guardia nocturna'],
      ],
      h3Pref: 'Niveles de Preferencia',
      prefRows: [
        ['💚', 'Preferido', 'Deseo este turno'],
        ['💙', 'Puedo', 'Puedo trabajar en este turno'],
        ['❌', 'No puedo', 'No estoy disponible para este turno'],
      ],
      h3How: 'Cómo Enviar una Solicitud',
      howSteps: [
        'Selecciona el mes deseado con las flechas de navegación',
        'Haz clic en una celda de día + turno en el calendario',
        'Haz clic de nuevo para alternar preferencias: 💚 → 💙 → ❌ → (vacío)',
        'Los cambios se guardan automáticamente',
      ],
      h3Default: 'Plantilla Semanal Predeterminada',
      defaultDesc: 'Puedes configurar un patrón recurrente para cada día de la semana — se aplicará automáticamente a los meses futuros.',
      h3Lock: 'Modo de Bloqueo',
      lockDesc: 'Cuando el horario está bloqueado, no se pueden cambiar las solicitudes. El calendario muestra un mensaje de bloqueo con la fecha esperada de apertura. Un gerente puede abrir una "ventana de excepción" temporal.',
      h3Approval: 'Aprobación de Cambios por el Empleado',
      approvalWorkerItems: [
        'Cuando un gerente cambia o cancela tu solicitud de turno, puede enviarte una solicitud de aprobación',
        'Recibirás un mensaje de chat con los detalles del cambio',
        'Haz clic en "✅ Sí, apruebo" para aceptar — el cambio se guardará',
        'Haz clic en "❌ No, rechazo" para declinar — la solicitud vuelve a tu preferencia original',
        'La celda del turno muestra ⏳ hasta que respondas',
      ],
      approvalAdminItems: [
        'Elige "Sí, enviar al empleado" — se envía un mensaje con botones de aprobar/rechazar al chat',
        'Elige "No, cambiar/cancelar yo mismo" — el cambio se guarda y se marca como "Modificado por admin" sin notificación',
        'Puedes añadir una nota personal que se adjuntará a la solicitud',
        'Recibirás una notificación por chat en cuanto el empleado responda',
      ],
    },

    vacations: {
      nav: 'Solicitudes de Vacaciones', h2: 'Solicitudes de Vacaciones',
      h3Submit: 'Enviar una Solicitud',
      submitSteps: [
        'Haz clic en "Nueva solicitud de vacaciones"',
        'Selecciona la fecha de inicio y la fecha de fin',
        'Añade una nota (opcional)',
        'Haz clic en "Enviar solicitud"',
      ],
      h3Status: 'Estados',
      statusRows: [
        ['Pendiente', 'Enviada, aún no revisada'],
        ['Aprobada', 'El gerente aprobó la solicitud'],
        ['Parcial', 'Algunas fechas fueron aprobadas'],
        ['Rechazada', 'Rechazada (el gerente puede haber dejado una nota)'],
        ['Cancelada', 'El empleado canceló la solicitud'],
      ],
      h3Cancel: 'Cancelar una Solicitud',
      cancelDesc: 'Solo puedes cancelar una solicitud en estado "Pendiente": haz clic en la solicitud → "Cancelar solicitud".',
    },

    messages: {
      nav: 'Mensajes', h2: 'Mensajes',
      h3Direct: 'Conversaciones Directas',
      directDesc: 'Haz clic en el nombre de un empleado o gerente para abrir una conversación. Escribe un mensaje y presiona Enter o el botón de enviar.',
      h3Content: 'Tipos de Contenido',
      contentItems: ['Texto libre', 'Imágenes (JPG, PNG)', 'Documentos (PDF, Word)', 'Videos', 'Enlaces — se muestra una vista previa automática'],
      h3Badge: 'Indicador de Mensajes No Leídos',
      badgeDesc: 'El ícono de mensajes (💬) en el menú muestra el recuento de mensajes no leídos.',
      h3ShiftApproval: 'Aprobaciones de Cambio de Turno',
      shiftApprovalItems: [
        'Cuando un gerente envía una solicitud de aprobación de cambio de turno, aparece como un mensaje especial resaltado',
        'Haz clic en "✅ Sí, apruebo" o "❌ No, rechazo" directamente en el chat',
        'Una vez respondido, los botones son reemplazados por una etiqueta de estado (Aprobado / Rechazado)',
        'El gerente recibe un mensaje automático con tu respuesta',
      ],
    },

    workers: {
      nav: 'Gestión de Empleados', h2: 'Gestión de Empleados',
      h3List: 'Lista de Empleados',
      listItems: [
        'Buscar por nombre o número de ID',
        'Filtrar por cargo, tipo de empleo, activo/inactivo',
        'Ordenar por cualquier columna',
        'Imprimir y exportar: selecciona campos → haz clic en "Imprimir"',
      ],
      h3Add: 'Agregar Nuevo Empleado — 4 Pestañas',
      addColTab: 'Pestaña', addColFields: 'Campos Clave',
      addRows: [
        ['Datos Personales', 'Título, nombre, ID, teléfono, foto'],
        ['Datos Organizacionales', 'Cargo, tipo de empleo, correo institucional, clasificación'],
        ['Asignación de Sucursales', 'Sucursal principal, sucursales secundarias (superadmin)'],
        ['Autorizaciones de Actividad', 'Disponible tras guardar al empleado'],
      ],
      h3Auth: 'Autorizaciones de Actividad',
      authSteps: [
        'Abre un empleado → pestaña "Autorizaciones de actividad"',
        'Haz clic en "Agregar autorización"',
        'Selecciona un tipo de actividad',
        'Establece la prioridad (1–5) — 5 = máxima prioridad en asignación automática',
      ],
      tip: 'El número de ID se convierte en el nombre de usuario. Crear un empleado crea automáticamente una cuenta de usuario.',
    },

    rooms: {
      nav: 'Asignación de Salas', nav_manual: '↳ Asignación Manual', nav_auto: '↳ Asignación Automática',
      h2: 'Asignación de Salas',
      desc: 'La pestaña central para gestionar asignaciones diarias. Muestra un calendario mensual donde cada celda es un día.',
      h3Colors: 'Colores de Estado en el Calendario',
      colorRows: [
        ['Verde', 'El empleado envió solicitud "Preferido"'],
        ['Azul', 'El empleado envió solicitud "Puedo"'],
        ['Gris', 'No se envió ninguna solicitud'],
        ['Rojo/Naranja', 'El empleado está de vacaciones'],
      ],
      h2Manual: 'Asignación Manual',
      manualSteps: [
        'Selecciona el mes con las flechas de navegación',
        'Haz clic en una celda de día — se abre un panel diario (arrastrable)',
        'Encuentra un sitio en la lista → haz clic en "Agregar asignación"',
        'Selecciona un empleado — verde = "Preferido", azul = "Puedo"',
        'Selecciona el tipo de actividad y tipo de turno',
        'Haz clic en "Guardar"',
      ],
      manualEdit: 'Para editar — haz clic en una asignación existente. Para eliminar — haz clic en ❌ junto a ella.',
      h2Auto: 'Asignación Automática',
      autoDesc: 'El algoritmo calcula la sugerencia óptima según solicitudes, autorizaciones y restricciones del sitio.',
      h3AutoSteps: 'Pasos para Ejecutar',
      autoSteps: [
        'Haz clic en un día del calendario para abrir el panel diario',
        'Haz clic en "Asignación automática"',
        'El sistema muestra sugerencias + puestos no ocupados con motivos',
        'Aprobar todo / aprobar individualmente / editar manualmente / cancelar',
      ],
      h3Score: 'Algoritmo de Puntuación (menor = mejor)',
      formula: 'puntuación = punt_preferencia + punt_prioridad + penalización_sobrecualificación + punt_equidad',
      formulaLines: [
        'punt_preferencia = 0 (preferido) / 1 (puedo)',
        'punt_prioridad = (5 − prioridad_empleado) × 0.4',
        'penalización_sobrecualificación = brecha_complejidad × 0.3',
        'punt_equidad = asignaciones_previas × 0.05',
      ],
      h3Unfilled: 'Razones Comunes para un Puesto no Ocupado',
      unfilledItems: [
        'No hay empleado autorizado para este tipo de actividad',
        'Todos los empleados autorizados están de vacaciones',
        'El cargo del empleado no está en la lista de cargos permitidos del sitio',
        'No se presentó solicitud de turno para ese día',
      ],
      h3Coverage: 'Cobertura durante Reuniones de Equipo',
      coverageDesc: 'Cuando un empleado está asignado a una sesión de reunión de equipo y también a un sitio al mismo tiempo, aparece un distintivo ⚠ Reunión en su asignación.',
      coverageItems: [
        'Haz clic en el distintivo ⚠ Reunión para abrir la ventana de gestión de cobertura',
        'El sistema sugiere sustitutos adecuados (no en reunión, autorizados para el sitio)',
        'Selecciona un sustituto — se aprueba automáticamente',
        'Al publicar el horario — ambas partes reciben una notificación',
      ],
    },

    specialDays: {
      nav: 'Días Especiales', h2: 'Días Especiales',
      desc: 'Gestiona un calendario de días festivos y eventos especiales.',
      steps: [
        'Haz clic en una fecha del calendario',
        'Ingresa el nombre del día (ej.: "Año Nuevo")',
        'Selecciona el tipo: Festivo / Evento / Otro',
        'Guardar',
      ],
      note: 'Los días especiales se resaltan automáticamente en el calendario de asignación de salas.',
    },

    report: {
      nav: 'Informe Mensual', h2: 'Informe Mensual',
      desc: 'Estadísticas de cumplimiento de solicitudes por tipo de turno.',
      items: ['Calendario mensual de todas las solicitudes', 'Número de empleados que solicitaron vs. asignados', 'Porcentaje de cumplimiento por tipo de turno'],
    },

    profileRequests: {
      nav: 'Solicitudes de Aprobación', h2: 'Solicitudes de Aprobación',
      desc1: 'Cola de solicitudes de cambio de perfil de empleados.',
      desc2: 'Cada solicitud muestra: nombre del empleado, campo cambiado, valor antiguo → valor nuevo, fecha.',
      items: ['Aprobar — el cambio se aplica de inmediato', 'Rechazar — puedes añadir una nota al empleado'],
    },

    events: {
      nav: 'Eventos', h2: 'Eventos',
      h3Create: 'Crear un Evento',
      createSteps: [
        'Haz clic en "Nuevo evento" → ingresa nombre, tipo, descripción',
        'Agrega invitados desde la lista de empleados',
        'Define sesiones: fecha, horarios, capacidad',
      ],
      h3Predict: 'Predecir Sesión 🔮',
      predictDesc: 'Ingresa una fecha + horarios hipotéticos — el sistema devuelve quién de los invitados puede asistir y quién tiene un conflicto.',
      h3Optimize: 'Optimización ⚡',
      optimizeDesc: 'Distribución automática máxima de empleados entre sesiones. El sistema informa quién fue asignado, quién no y por qué.',
      h3OptimizeAlgo: 'Cómo funciona el algoritmo',
      optimizeAlgoSteps: [
        'Para cada invitado — se calcula a cuántas sesiones puede asistir (sin conflicto de asignación de sitio)',
        'Se ordenan los invitados por flexibilidad ascendente: quienes pueden asistir a menos sesiones tienen prioridad',
        'Para cada sesión (en orden cronológico) — se llenan con los trabajadores menos flexibles que pueden asistir',
        'Cada trabajador se asigna a una sola sesión',
        'Quienes solo pueden ir a una sesión no serán "robados" por una sesión anterior',
      ],
      h3OptimizeLimits: 'Limitaciones',
      optimizeLimitItems: [
        'No recalcula asignaciones existentes',
        'Algoritmo voraz — no garantiza de forma absoluta la asignación global máxima',
      ],
    },

    settings: {
      nav: 'Configuración del Sistema', h2: 'Configuración del Sistema',
      desc: 'Accesible desde el menú ⚙️. Contiene 10 pestañas:',
      colTab: 'Pestaña', colDesc: 'Descripción',
      settingsRows: [
        ['Cargos', 'Agregar / editar / eliminar títulos de trabajo'],
        ['Tipos de Empleo', 'Definiciones de categorías de empleo'],
        ['Honoríficos', 'Prefijos de nombre (Dr., Prof.)'],
        ['Grupos y Sitios', 'Departamentos, salas, restricciones de cargo, indicador de equidad ⚖️'],
        ['Tipos de Actividad', 'Procedimientos con nivel de complejidad 1–3'],
        ['Horarios de Turno', 'Tiempos de inicio/fin predeterminados por tipo de turno'],
        ['Bloqueo de Horario', 'Modo de bloqueo + ventana de excepción temporal'],
        ['Brechas de Formación', 'Análisis de autorizaciones faltantes en el equipo'],
        ['Jerarquía', 'Estructura de permisos organizacionales (superadmin)'],
        ['Sucursales', 'Crear / eliminar sucursales (superadmin)'],
      ],
      h3JobRestrict: 'Restricciones de Cargo por Sitio',
      jobRestrictDesc: 'En la pestaña "Grupos y Sitios" — haz clic en "Cargos" junto a un sitio para restringir qué títulos se permiten. El algoritmo automático no asignará a un empleado cuyo cargo no esté en la lista.',
      h3LockModes: 'Bloqueo de Horario',
      lockColMode: 'Modo', lockColDesc: 'Descripción',
      lockRows: [
        ['Mensual', 'Se bloquea automáticamente en un día determinado de cada mes'],
        ['Semanal', 'Se bloquea automáticamente en un día determinado de cada semana'],
        ['Ventana de Excepción', 'Apertura temporal para un rango de fechas definido'],
      ],
    },

    clusters: {
      nav: 'Gestión de Clústeres', h2: 'Gestión de Clústeres — Cirujanos',
      desc: 'Pestaña para gestionar cirujanos y sus clústeres de empleados preferidos. El clúster afecta la asignación visualmente (manual) y algorítmicamente (automática).',

      h3What: '¿Qué es un Clúster?',
      whatDesc: 'Un clúster es una lista de empleados (anestesiólogos, enfermeras, técnicos) que un cirujano prefiere tener en sus intervenciones. El sistema usa esta lista para priorizar a esos empleados — en la vista manual y en el algoritmo automático — cuando se asigna a una fila vinculada a ese cirujano.',

      h3SurgeonInShift: 'Cirujano como Tipo de Actividad',
      surgeonInShiftDesc: 'En la ventana de gestión de turno, al agregar una fila de actividad, puedes elegir "🔬 Cirujano" en lugar de un tipo de actividad estándar. La fila se muestra en azul con el nombre del cirujano. Cada asignación a esa fila está influenciada por el clúster del cirujano.',

      h3HowCluster: 'Efecto del Clúster — Asignación Manual',
      clusterItems: [
        '★ Los empleados del clúster aparecen primero, marcados con ★',
        'Checkbox "Solo Clúster" — filtra para mostrar únicamente empleados del clúster',
        'Los empleados fuera del clúster se muestran debajo, separados visualmente',
      ],

      h3AutoScore: 'Efecto del Clúster — Asignación Automática',
      autoScoreDesc: 'El algoritmo calcula una puntuación por empleado candidato por fila. Puntuación más baja = mayor prioridad. La fórmula:',
      scoreFormulaRows: [
        ['Preferencia de turno', '0 (preferido) / 1 (puede)', 'Basado en la solicitud del empleado'],
        ['Prioridad de actividad', '(5 − prioridad) × 0.4', 'De la autorización de actividad (1–5)'],
        ['Sobrecalificación', 'brecha × 0.3', 'Demasiado calificado para una fila simple — menor prioridad'],
        ['Equidad', 'asignaciones × 0.05', 'Menos asignado obtiene ligera ventaja'],
        ['Penalización clúster', '+1.5 si no está en clúster', 'Empleado fuera del clúster del cirujano — penalización fuerte'],
      ],
      scoreColFactor: 'Factor', scoreColValue: 'Valor', scoreColNote: 'Nota',
      autoScoreNote: 'La penalización del clúster (1.5) es mayor que la diferencia entre "preferido" y "puede" (1.0). Un empleado del clúster que solicitó "puede" supera a uno fuera del clúster que solicitó "preferido". La preferencia de clúster anula la preferencia de turno. Si no hay empleados del clúster disponibles, el algoritmo continúa con los demás trabajadores elegibles.',

      h3Workflow: 'Flujo de Trabajo de Extremo a Extremo',
      workflowItems: [
        'Crear cirujano: pestaña "Gestión de Clústeres" → "Agregar" → nombre + grupo de actividad',
        'Construir clúster: clic en el nombre del cirujano → agregar empleados relevantes',
        'Asignar cirujano a sala: "Asignaciones de Sala" → clic en un día → abrir panel → "Agregar Fila" → elegir "🔬 Cirujano"',
        'Asignación manual: clic "Agregar Asignación" en la fila del cirujano → empleados del clúster marcados ★ aparecen primero',
        'Asignación automática: clic "Asignación Automática" → el algoritmo favorece a los empleados del clúster',
      ],

      h3ManageSurgeons: 'Gestión de Cirujanos',
      manageSurgeonsItems: [
        'Agregar cirujano: ingresa nombre → selecciona grupo de actividad (opcional) → clic "Agregar"',
        'Grupo de actividad: solo para filtrar la lista — no restringe asignaciones',
        'Editar cirujano: clic ✏️ → cambia nombre/grupo → clic "Guardar"',
        'Eliminar cirujano: clic 🗑 — permanente, elimina el clúster y desconecta filas existentes',
        'Filtrar lista: selecciona un grupo de actividad en el filtro superior',
      ],

      h3ManageCluster: 'Gestión de un Clúster',
      manageClusterItems: [
        'Clic en el nombre del cirujano — el panel del clúster se abre',
        'Los empleados actuales aparecen como etiquetas azules con botón ✕ para eliminar',
        'Agregar empleado: filtra por cargo → escribe nombre → clic en el nombre — se agrega de inmediato',
        'Sin límite de tamaño del clúster',
        'El mismo empleado puede aparecer en los clústeres de varios cirujanos',
      ],

      tip: 'Se recomienda construir los clústeres antes del ciclo de programación mensual. Cuanto mayor sea el clúster, más flexibilidad tiene el algoritmo para encontrar un empleado preferido disponible.',
    },

    workerAvailability: {
      nav: 'Disponibilidad de empleados', h2: 'Ventana de disponibilidad de empleados',
      desc: 'Esta ventana resume el estado de los empleados para la fecha seleccionada. Se divide en cuatro grupos:',
      groupRows: [
        ['Disponibles por turno', 'Empleados que enviaron una solicitud "puede" o "prefiere" para esta fecha — agrupados por el turno solicitado'],
        ['No asignados', 'Empleados que pidieron trabajar pero aún no han sido asignados a ningún sitio. Cada empleado muestra una razón: "No seleccionado" (hay lugares disponibles), "Sitios llenos" (sin lugares), "Sin actividad" (no hay actividad configurada para el turno)'],
        ['Vacaciones aprobadas', 'Empleados con vacaciones aprobadas en esta fecha'],
        ['No disponibles / Sin solicitud', 'Empleados que marcaron "no puede" (etiqueta "No puede") o que no enviaron ninguna solicitud (etiqueta "Sin solicitud")'],
      ],
    },
  },

  /* ═══════════════════════════════════════════════════ FRENCH */
  fr: {
    title: '📖 Guide Utilisateur',
    navUser: 'Utilisateur', navAdmin: 'Administrateur',
    adminDivider: 'Onglets Administrateur',
    colSymbol: 'Symbole', colName: 'Nom', colDesc: 'Description', colMeaning: 'Signification',
    colStatus: 'Statut', colTab: 'Onglet', colColor: 'Couleur',

    profile: {
      nav: 'Mon Profil', h2: 'Mon Profil',
      desc: 'Gérez vos données personnelles dans le système.',
      h3Edit: 'Modifier les Données Personnelles',
      editItems: [
        'Téléphone mobile, adresse e-mail personnelle',
        'Les modifications nécessitent l\'approbation du responsable avant d\'être effectives',
        'Les modifications en attente sont marquées "En attente d\'approbation"',
      ],
      h3Photo: 'Photo de Profil',
      photoSteps: [
        'Cliquez sur le cercle de la photo',
        'Choisissez "Télécharger une photo" ou "Prendre une photo"',
        'Recadrez l\'image dans la fenêtre de recadrage',
        'Cliquez sur "Enregistrer" — la photo est mise à jour immédiatement',
      ],
    },

    shifts: {
      nav: 'Demandes de Garde', h2: 'Demandes de Garde',
      desc: 'Calendrier mensuel pour gérer vos préférences de garde.',
      h3Types: 'Types de Garde',
      shiftRows: [
        ['☀️', 'Matin', 'Garde du matin régulière'],
        ['🌙', 'Soir', 'Garde du soir'],
        ['📞', 'Astreinte', 'Astreinte à domicile'],
        ['⭐', 'Nuit', 'Garde de nuit'],
      ],
      h3Pref: 'Niveaux de Préférence',
      prefRows: [
        ['💚', 'Préféré', 'Je souhaite cette garde'],
        ['💙', 'Possible', 'Je peux travailler cette garde'],
        ['❌', 'Impossible', 'Je ne suis pas disponible pour cette garde'],
      ],
      h3How: 'Comment Soumettre une Demande',
      howSteps: [
        'Sélectionnez le mois souhaité avec les flèches de navigation',
        'Cliquez sur une cellule jour + garde dans le calendrier',
        'Cliquez à nouveau pour alterner les préférences : 💚 → 💙 → ❌ → (vide)',
        'Les modifications sont enregistrées automatiquement',
      ],
      h3Default: 'Modèle Hebdomadaire par Défaut',
      defaultDesc: 'Vous pouvez définir un modèle récurrent pour chaque jour de la semaine — il s\'appliquera automatiquement aux mois futurs.',
      h3Lock: 'Mode Verrouillage',
      lockDesc: 'Lorsque le planning est verrouillé, les demandes ne peuvent pas être modifiées. Le calendrier affiche un message de verrouillage avec la date d\'ouverture prévue. Un responsable peut ouvrir une "fenêtre d\'exception" temporaire.',
      h3Approval: 'Approbation des Changements par l\'Employé',
      approvalWorkerItems: [
        'Lorsqu\'un responsable modifie ou annule votre demande de garde, une demande d\'approbation peut vous être envoyée',
        'Vous recevrez un message de chat avec les détails du changement',
        'Cliquez sur "✅ Oui, j\'approuve" pour accepter — le changement sera enregistré',
        'Cliquez sur "❌ Non, je refuse" pour décliner — la demande revient à votre préférence d\'origine',
        'La cellule de garde affiche ⏳ jusqu\'à votre réponse',
      ],
      approvalAdminItems: [
        'Choisissez "Oui, envoyer à l\'employé" — un message avec boutons approuver/refuser est envoyé dans le chat',
        'Choisissez "Non, modifier/annuler moi-même" — le changement est enregistré et marqué "Modifié par l\'admin" sans notification',
        'Vous pouvez ajouter une note personnelle qui sera jointe à la demande',
        'Vous recevrez une notification par chat dès que l\'employé aura répondu',
      ],
    },

    vacations: {
      nav: 'Demandes de Congé', h2: 'Demandes de Congé',
      h3Submit: 'Soumettre une Demande',
      submitSteps: [
        'Cliquez sur "Nouvelle demande de congé"',
        'Sélectionnez la date de début et la date de fin',
        'Ajoutez une note (optionnel)',
        'Cliquez sur "Envoyer la demande"',
      ],
      h3Status: 'Statuts',
      statusRows: [
        ['En attente', 'Soumise, pas encore examinée'],
        ['Approuvée', 'Le responsable a approuvé la demande'],
        ['Partielle', 'Certaines dates ont été approuvées'],
        ['Refusée', 'Refusée (le responsable a peut-être laissé une note)'],
        ['Annulée', 'L\'employé a annulé la demande'],
      ],
      h3Cancel: 'Annuler une Demande',
      cancelDesc: 'Vous pouvez annuler une demande en statut "En attente" uniquement : cliquez sur la demande → "Annuler la demande".',
    },

    messages: {
      nav: 'Messagerie', h2: 'Messagerie',
      h3Direct: 'Conversations Directes',
      directDesc: 'Cliquez sur le nom d\'un employé ou d\'un responsable pour ouvrir une conversation. Saisissez un message et appuyez sur Entrée ou le bouton d\'envoi.',
      h3Content: 'Types de Contenu',
      contentItems: ['Texte libre', 'Images (JPG, PNG)', 'Documents (PDF, Word)', 'Vidéos', 'Liens — un aperçu automatique est affiché'],
      h3Badge: 'Badge Messages Non Lus',
      badgeDesc: 'L\'icône des messages (💬) dans le menu affiche le nombre de messages non lus.',
      h3ShiftApproval: 'Approbations de Changement de Garde',
      shiftApprovalItems: [
        'Lorsqu\'un responsable envoie une demande d\'approbation de changement de garde, elle apparaît comme un message spécial mis en évidence',
        'Cliquez sur "✅ Oui, j\'approuve" ou "❌ Non, je refuse" directement dans le chat',
        'Après réponse, les boutons sont remplacés par un libellé de statut (Approuvé / Refusé)',
        'Le responsable reçoit un message automatique avec votre réponse',
      ],
    },

    workers: {
      nav: 'Gestion des Employés', h2: 'Gestion des Employés',
      h3List: 'Liste des Employés',
      listItems: [
        'Recherche par nom ou numéro d\'identification',
        'Filtrer par poste, type d\'emploi, actif/inactif',
        'Trier par n\'importe quelle colonne',
        'Imprimer et exporter : sélectionnez les champs → cliquez sur "Imprimer"',
      ],
      h3Add: 'Ajouter un Nouvel Employé — 4 Onglets',
      addColTab: 'Onglet', addColFields: 'Champs Principaux',
      addRows: [
        ['Données Personnelles', 'Titre, nom, ID, téléphone, photo'],
        ['Données Organisationnelles', 'Poste, type d\'emploi, e-mail institutionnel, classification'],
        ['Affectation aux Branches', 'Branche principale, branches secondaires (super-admin)'],
        ['Autorisations d\'Activité', 'Disponible après l\'enregistrement de l\'employé'],
      ],
      h3Auth: 'Autorisations d\'Activité',
      authSteps: [
        'Ouvrez un employé → onglet "Autorisations d\'activité"',
        'Cliquez sur "Ajouter une autorisation"',
        'Sélectionnez un type d\'activité',
        'Définissez la priorité (1–5) — 5 = priorité maximale en affectation automatique',
      ],
      tip: 'Le numéro d\'ID devient le nom d\'utilisateur. Créer un employé crée automatiquement un compte utilisateur.',
    },

    rooms: {
      nav: 'Affectations aux Salles', nav_manual: '↳ Affectation Manuelle', nav_auto: '↳ Affectation Automatique',
      h2: 'Affectations aux Salles',
      desc: 'L\'onglet central pour gérer les affectations quotidiennes. Affiche un calendrier mensuel où chaque cellule est un jour.',
      h3Colors: 'Couleurs de Statut du Calendrier',
      colorRows: [
        ['Vert', 'L\'employé a soumis une demande "Préféré"'],
        ['Bleu', 'L\'employé a soumis une demande "Possible"'],
        ['Gris', 'Aucune demande soumise'],
        ['Rouge/Orange', 'L\'employé est en congé'],
      ],
      h2Manual: 'Affectation Manuelle',
      manualSteps: [
        'Sélectionnez le mois avec les flèches de navigation',
        'Cliquez sur une cellule de jour — un panneau journalier s\'ouvre (déplaçable)',
        'Trouvez un site dans la liste → cliquez sur "Ajouter une affectation"',
        'Sélectionnez un employé — vert = "Préféré", bleu = "Possible"',
        'Sélectionnez le type d\'activité et le type de garde',
        'Cliquez sur "Enregistrer"',
      ],
      manualEdit: 'Pour modifier — cliquez sur une affectation existante. Pour supprimer — cliquez sur ❌ à côté.',
      h2Auto: 'Affectation Automatique',
      autoDesc: 'L\'algorithme calcule la suggestion optimale selon les demandes, les autorisations et les restrictions du site.',
      h3AutoSteps: 'Étapes d\'Exécution',
      autoSteps: [
        'Cliquez sur un jour du calendrier pour ouvrir le panneau journalier',
        'Cliquez sur "Affectation automatique"',
        'Le système affiche les suggestions + postes non pourvus avec les raisons',
        'Tout approuver / approuver individuellement / modifier manuellement / annuler',
      ],
      h3Score: 'Algorithme de Notation (plus bas = meilleur)',
      formula: 'score = score_préf + score_priorité + pénalité_surqualification + score_équité',
      formulaLines: [
        'score_préf = 0 (préféré) / 1 (possible)',
        'score_priorité = (5 − priorité_employé) × 0.4',
        'pénalité_surqualification = écart_complexité × 0.3',
        'score_équité = affectations_précédentes × 0.05',
      ],
      h3Unfilled: 'Raisons Courantes pour un Poste Non Pourvu',
      unfilledItems: [
        'Aucun employé autorisé pour ce type d\'activité',
        'Tous les employés autorisés sont en congé',
        'Le poste de l\'employé n\'est pas dans la liste des postes autorisés du site',
        'Aucune demande de garde soumise pour ce jour',
      ],
      h3Coverage: 'Couverture pendant les Réunions d\'Équipe',
      coverageDesc: 'Lorsqu\'un employé est affecté à une session de réunion d\'équipe et aussi à un site en même temps, un badge ⚠ Réunion apparaît sur son affectation.',
      coverageItems: [
        'Cliquez sur le badge ⚠ Réunion pour ouvrir la fenêtre de gestion de couverture',
        'Le système suggère des remplaçants adéquats (pas en réunion, autorisés pour le site)',
        'Sélectionnez un remplaçant — il est approuvé automatiquement',
        'À la publication du planning — les deux parties reçoivent une notification',
      ],
    },

    specialDays: {
      nav: 'Jours Spéciaux', h2: 'Jours Spéciaux',
      desc: 'Gérez un calendrier de jours fériés et d\'événements spéciaux.',
      steps: [
        'Cliquez sur une date du calendrier',
        'Entrez le nom du jour (ex. : "Jour de l\'An")',
        'Sélectionnez le type : Férié / Événement / Autre',
        'Enregistrer',
      ],
      note: 'Les jours spéciaux sont automatiquement mis en évidence dans le calendrier d\'affectation des salles.',
    },

    report: {
      nav: 'Rapport Mensuel', h2: 'Rapport Mensuel',
      desc: 'Statistiques de satisfaction des demandes par type de garde.',
      items: ['Calendrier mensuel de toutes les demandes', 'Nombre d\'employés ayant demandé vs. affectés', 'Pourcentage de satisfaction par type de garde'],
    },

    profileRequests: {
      nav: 'Demandes d\'Approbation', h2: 'Demandes d\'Approbation',
      desc1: 'File d\'attente des demandes de modification de profil des employés.',
      desc2: 'Chaque demande affiche : nom de l\'employé, champ modifié, ancienne valeur → nouvelle valeur, date.',
      items: ['Approuver — la modification est appliquée immédiatement', 'Rejeter — vous pouvez ajouter une note à l\'employé'],
    },

    events: {
      nav: 'Événements', h2: 'Événements',
      h3Create: 'Créer un Événement',
      createSteps: [
        'Cliquez sur "Nouvel événement" → entrez le nom, le type, la description',
        'Ajoutez des invités depuis la liste des employés',
        'Définissez les sessions : date, horaires, capacité',
      ],
      h3Predict: 'Prédire une Session 🔮',
      predictDesc: 'Entrez une date + horaires hypothétiques — le système retourne qui parmi les invités peut assister et qui a un conflit.',
      h3Optimize: 'Optimisation ⚡',
      optimizeDesc: 'Distribution automatique maximale des employés entre les sessions. Le système indique qui a été affecté, qui ne l\'a pas été et pourquoi.',
      h3OptimizeAlgo: 'Comment fonctionne l\'algorithme',
      optimizeAlgoSteps: [
        'Pour chaque invité — calcul du nombre de sessions auxquelles il peut assister (sans conflit d\'affectation de site)',
        'Tri des invités par flexibilité croissante : ceux qui peuvent assister à moins de sessions ont la priorité',
        'Pour chaque session (dans l\'ordre chronologique) — remplissage avec les travailleurs les moins flexibles pouvant y assister',
        'Chaque travailleur est affecté à une seule session maximum',
        'Ceux qui ne sont disponibles que pour une seule session ne seront pas "volés" par une autre',
      ],
      h3OptimizeLimits: 'Limitations',
      optimizeLimitItems: [
        'Ne recalcule pas les affectations existantes',
        'Algorithme glouton — ne garantit pas de manière absolue l\'affectation globale maximale',
      ],
    },

    settings: {
      nav: 'Paramètres Système', h2: 'Paramètres Système',
      desc: 'Accessible depuis le menu ⚙️. Contient 10 onglets :',
      colTab: 'Onglet', colDesc: 'Description',
      settingsRows: [
        ['Postes', 'Ajouter / modifier / supprimer les intitulés de poste'],
        ['Types d\'Emploi', 'Définitions des catégories d\'emploi'],
        ['Titres', 'Préfixes de nom (Dr., Prof.)'],
        ['Groupes et Sites', 'Départements, salles, restrictions de poste, indicateur d\'équité ⚖️'],
        ['Types d\'Activité', 'Procédures avec niveau de complexité 1–3'],
        ['Heures de Garde', 'Heures de début/fin par défaut par type de garde'],
        ['Verrouillage du Planning', 'Mode de verrouillage + fenêtre d\'exception temporaire'],
        ['Lacunes de Formation', 'Analyse des autorisations manquantes dans l\'équipe'],
        ['Hiérarchie', 'Structure des autorisations organisationnelles (super-admin)'],
        ['Branches', 'Créer / supprimer des branches (super-admin)'],
      ],
      h3JobRestrict: 'Restrictions de Poste par Site',
      jobRestrictDesc: 'Dans l\'onglet "Groupes et Sites" — cliquez sur "Postes" à côté d\'un site pour restreindre les intitulés autorisés. L\'algorithme automatique n\'affectera pas un employé dont le poste n\'est pas dans la liste.',
      h3LockModes: 'Verrouillage du Planning',
      lockColMode: 'Mode', lockColDesc: 'Description',
      lockRows: [
        ['Mensuel', 'Se verrouille automatiquement un jour précis de chaque mois'],
        ['Hebdomadaire', 'Se verrouille automatiquement un jour précis de chaque semaine'],
        ['Fenêtre d\'Exception', 'Ouverture temporaire pour une plage de dates définie'],
      ],
    },

    clusters: {
      nav: 'Gestion des Clusters', h2: 'Gestion des Clusters — Chirurgiens',
      desc: 'Onglet pour gérer les chirurgiens et leurs clusters d\'employés préférés. Le cluster affecte l\'affectation visuellement (manuelle) et algorithmiquement (automatique).',

      h3What: 'Qu\'est-ce qu\'un Cluster ?',
      whatDesc: 'Un cluster est une liste d\'employés (anesthésistes, infirmiers, techniciens) qu\'un chirurgien préfère avoir dans ses interventions. Le système utilise cette liste pour prioriser ces employés — dans la vue manuelle et dans l\'algorithme automatique — lors de l\'affectation à une ligne liée à ce chirurgien.',

      h3SurgeonInShift: 'Chirurgien comme Type d\'Activité',
      surgeonInShiftDesc: 'Dans la fenêtre de gestion des gardes, lors de l\'ajout d\'une ligne d\'activité, vous pouvez choisir "🔬 Chirurgien" à la place d\'un type d\'activité standard. La ligne s\'affiche en bleu avec le nom du chirurgien. Chaque affectation à cette ligne est influencée par le cluster du chirurgien.',

      h3HowCluster: 'Effet du Cluster — Affectation Manuelle',
      clusterItems: [
        '★ Les employés du cluster apparaissent en premier, marqués ★',
        'Case "Cluster Uniquement" — filtre pour afficher seulement les employés du cluster',
        'Les employés hors cluster sont affichés en dessous, séparés visuellement',
      ],

      h3AutoScore: 'Effet du Cluster — Affectation Automatique',
      autoScoreDesc: 'L\'algorithme calcule un score pour chaque employé candidat par ligne. Score plus bas = priorité plus haute. La formule :',
      scoreFormulaRows: [
        ['Préférence de garde', '0 (préféré) / 1 (peut)', 'Basé sur la demande de l\'employé'],
        ['Priorité d\'activité', '(5 − priorité) × 0.4', 'De l\'autorisation d\'activité (1–5)'],
        ['Surqualification', 'écart × 0.3', 'Trop qualifié pour un poste simple — priorité moindre'],
        ['Équité', 'affectations × 0.05', 'Le moins affecté bénéficie d\'un léger avantage'],
        ['Pénalité cluster', '+1.5 si hors cluster', 'Employé hors cluster du chirurgien — pénalité forte'],
      ],
      scoreColFactor: 'Facteur', scoreColValue: 'Valeur', scoreColNote: 'Note',
      autoScoreNote: 'La pénalité du cluster (1.5) est supérieure à l\'écart entre "préféré" et "peut" (1.0). Un employé du cluster ayant demandé "peut" l\'emporte sur un hors-cluster ayant demandé "préféré". La préférence de cluster prime sur la préférence de garde. Si aucun employé du cluster n\'est disponible, l\'algorithme continue avec les autres travailleurs éligibles.',

      h3Workflow: 'Flux de Travail de Bout en Bout',
      workflowItems: [
        'Créer chirurgien : onglet "Gestion des Clusters" → "Ajouter" → nom + groupe d\'activité',
        'Construire le cluster : cliquez sur le nom du chirurgien → ajoutez les employés concernés',
        'Affecter chirurgien à une salle : "Affectations aux Salles" → clic jour → ouvrir panneau → "Ajouter Ligne" → choisir "🔬 Chirurgien"',
        'Affectation manuelle : cliquez "Ajouter Affectation" sur la ligne du chirurgien → employés du cluster marqués ★ apparaissent en premier',
        'Affectation automatique : cliquez "Affectation Automatique" → l\'algorithme favorise les employés du cluster',
      ],

      h3ManageSurgeons: 'Gestion des Chirurgiens',
      manageSurgeonsItems: [
        'Ajouter chirurgien : saisissez le nom → sélectionnez un groupe d\'activité (optionnel) → cliquez "Ajouter"',
        'Groupe d\'activité : pour le filtrage de la liste uniquement — ne restreint pas les affectations',
        'Modifier chirurgien : cliquez ✏️ → modifiez le nom/groupe → cliquez "Enregistrer"',
        'Supprimer chirurgien : cliquez 🗑 — définitif, supprime le cluster et déconnecte les lignes existantes',
        'Filtrer la liste : sélectionnez un groupe d\'activité dans le filtre en haut',
      ],

      h3ManageCluster: 'Gestion d\'un Cluster',
      manageClusterItems: [
        'Cliquez sur le nom d\'un chirurgien — le panneau du cluster s\'ouvre',
        'Les employés actuels apparaissent comme des étiquettes bleues avec un bouton ✕ pour supprimer',
        'Ajouter un employé : filtrez par poste → tapez un nom → cliquez sur le nom — ajouté immédiatement',
        'Pas de limite de taille pour le cluster',
        'Le même employé peut apparaître dans les clusters de plusieurs chirurgiens',
      ],

      tip: 'Il est recommandé de constituer les clusters avant le cycle de planification mensuel. Plus le cluster est grand, plus l\'algorithme a de flexibilité pour trouver un employé préféré disponible.',
    },

    workerAvailability: {
      nav: 'Disponibilité des employés', h2: 'Fenêtre de disponibilité des employés',
      desc: 'Cette fenêtre résume le statut des employés pour la date sélectionnée. Elle est divisée en quatre groupes :',
      groupRows: [
        ['Disponibles par quart', 'Employés ayant soumis une demande "peut" ou "préfère" pour cette date — affichés par quart demandé'],
        ['Non affectés', 'Employés ayant demandé à travailler mais pas encore affectés à un site. Chaque employé affiche une raison : "Non sélectionné" (des créneaux sont disponibles), "Sites complets" (pas de créneau), "Pas d\'activité" (aucune activité configurée pour le quart)'],
        ['Congés approuvés', 'Employés avec un congé approuvé à cette date'],
        ['Indisponibles / Sans demande', 'Employés ayant marqué "ne peut pas" (badge "Ne peut pas") ou n\'ayant soumis aucune demande (badge "Sans demande")'],
      ],
    },
  },
};
