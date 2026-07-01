export type Locale = "el" | "en";
export type GroupType = "building" | "school" | "association" | "other";
export type SplitMethod = "by_area" | "equal" | "custom_weight";

const strings = {
  el: {
    appTitle: "Πλατφόρμα Εισπράξεων",
    appSubtitle: "Συλλογή εισφορών και εβδομαδιαία μεταφορά στο ταμείο",
    login: "Σύνδεση",
    email: "Email",
    password: "Κωδικός",
    logout: "Αποσύνδεση",
    home: "Αρχική",
    groups: "Ομάδες",
    addGroup: "Νέα ομάδα",
    groupName: "Όνομα ομάδας",
    groupType: "Τύπος ομάδας",
    splitMethod: "Κατανομή χρέωσης",
    typeBuilding: "Πολυκατοικία",
    typeSchool: "Σχολική κοινότητα",
    typeAssociation: "Σύλλογος",
    typeOther: "Άλλο",
    splitByArea: "Ανά εμβαδόν (m²)",
    splitEqual: "Ίσα μερίδια",
    splitCustomWeight: "Προσαρμοσμένα βάρη",
    outstanding: "Ανείσπρακτα",
    overdue: "Ληξιπρόθεσμα",
    collected: "Εισπράχθηκαν (μήνας)",
    heldForPayout: "Κρατούμενα για μεταφορά",
    sentToCommittee: "Στάλθηκαν στο ταμείο",
    members: "Μέλη",
    expenses: "Χρεώσεις",
    charges: "Χρεώσεις",
    collections: "Εισπράξεις",
    payouts: "Μεταφορές",
    addExpense: "Νέα χρέωση",
    all: "Όλα",
    statusPaid: "Πληρώθηκε",
    statusPending: "Εκκρεμεί",
    statusOverdue: "Ληξιπρόθεσμο",
    statusHeld: "Κρατείται",
    statusPaidOut: "Μεταφέρθηκε",
    statusUnmatched: "Χωρίς αντιστοίχιση",
    confirm: "Επιβεβαίωση",
    cancel: "Ακύρωση",
    next: "Επόμενο",
    back: "Πίσω",
    preview: "Προεπισκόπηση",
    distribute: "Κατανομή & αποστολή",
    noGroups: "Δεν υπάρχουν ομάδες ακόμα",
    createFirst: "Προσθέστε την πρώτη ομάδα",
    address: "Διεύθυνση",
    collectionIban: "IBAN εισπράξεων",
    committeeIban: "IBAN ταμείου (επιτροπή)",
    committeeName: "Όνομα δικαιούχου ταμείου",
    enablePayout: "Εβδομαδιαία μεταφορά (Παρασκευή)",
    memberNumber: "Αρ. μέλους",
    memberNumberSchool: "Τάξη / μαθητής",
    ownerName: "Όνομα",
    phone: "Τηλέφωνο",
    area: "Εμβαδόν (m²)",
    weight: "Βάρος",
    amount: "Ποσό",
    category: "Κατηγορία",
    vendor: "Προμηθευτής / σημείωση",
    date: "Ημερομηνία",
    sendReminder: "Αποστολή υπενθύμισης",
    copyReference: "Αντιγραφή αναφοράς",
    paymentQr: "QR πληρωμής",
    needsAttention: "Χρειάζεται προσοχή",
    loading: "Φόρτωση…",
    error: "Σφάλμα",
    nextPayout: "Επόμενη μεταφορά",
    payoutHistory: "Ιστορικό μεταφορών",
    payoutPending: "Προς μεταφορά",
    payoutMinimum: "Ελάχιστο ποσό μεταφοράς",
    runPayoutDryRun: "Δοκιμαστική μεταφορά",
    runPayoutForce: "Μεταφορά τώρα",
    payoutConfig: "Ρυθμίσεις ταμείου",
    save: "Αποθήκευση",
    lastPayout: "Τελευταία μεταφορά",
    catMaintenance: "Συντήρηση",
    catUtilities: "Κοινόχρηστα",
    catDues: "Εισφορές",
    catEvent: "Εκδήλωση",
    catInsurance: "Ασφάλεια",
    catOther: "Άλλο",
    share: "Μερίδιο",
  },
  en: {
    appTitle: "Collection Platform",
    appSubtitle: "Collect contributions and pay out to committee every Friday",
    login: "Sign in",
    email: "Email",
    password: "Password",
    logout: "Sign out",
    home: "Home",
    groups: "Groups",
    addGroup: "New group",
    groupName: "Group name",
    groupType: "Group type",
    splitMethod: "Charge split",
    typeBuilding: "Building",
    typeSchool: "School community",
    typeAssociation: "Association",
    typeOther: "Other",
    splitByArea: "By area (m²)",
    splitEqual: "Equal shares",
    splitCustomWeight: "Custom weights",
    outstanding: "Unpaid",
    overdue: "Overdue",
    collected: "Collected (month)",
    heldForPayout: "Held for payout",
    sentToCommittee: "Sent to committee",
    members: "Members",
    expenses: "Charges",
    charges: "Charges",
    collections: "Collections",
    payouts: "Payouts",
    addExpense: "Add charge",
    all: "All",
    statusPaid: "Paid",
    statusPending: "Pending",
    statusOverdue: "Overdue",
    statusHeld: "Held",
    statusPaidOut: "Paid out",
    statusUnmatched: "Unmatched",
    confirm: "Confirm",
    cancel: "Cancel",
    next: "Next",
    back: "Back",
    preview: "Preview",
    distribute: "Distribute & notify",
    noGroups: "No groups yet",
    createFirst: "Add your first group",
    address: "Address",
    collectionIban: "Collection IBAN",
    committeeIban: "Committee bank IBAN",
    committeeName: "Committee account name",
    enablePayout: "Weekly payout (Friday)",
    memberNumber: "Member no.",
    memberNumberSchool: "Class / student",
    ownerName: "Name",
    phone: "Phone",
    area: "Area (m²)",
    weight: "Weight",
    amount: "Amount",
    category: "Category",
    vendor: "Vendor / note",
    date: "Date",
    sendReminder: "Send reminder",
    copyReference: "Copy reference",
    paymentQr: "Payment QR",
    needsAttention: "Needs attention",
    loading: "Loading…",
    error: "Error",
    nextPayout: "Next payout",
    payoutHistory: "Payout history",
    payoutPending: "Pending payout",
    payoutMinimum: "Minimum payout",
    runPayoutDryRun: "Dry-run payout",
    runPayoutForce: "Run payout now",
    payoutConfig: "Committee setup",
    save: "Save",
    lastPayout: "Last payout",
    catMaintenance: "Maintenance",
    catUtilities: "Utilities",
    catDues: "Dues",
    catEvent: "Event",
    catInsurance: "Insurance",
    catOther: "Other",
    share: "Share",
  },
} as const;

let currentLocale: Locale = "el";

export function setLocale(locale: Locale) {
  currentLocale = locale;
}

export function getLocale(): Locale {
  return currentLocale;
}

export function t(key: keyof (typeof strings)["el"]): string {
  return strings[currentLocale][key] ?? strings.el[key];
}

export function memberNumberLabel(groupType?: GroupType): string {
  return groupType === "school" ? t("memberNumberSchool") : t("memberNumber");
}

export function categoryLabel(category: string): string {
  const map: Record<string, keyof (typeof strings)["el"]> = {
    maintenance: "catMaintenance",
    utilities: "catUtilities",
    dues: "catDues",
    event: "catEvent",
    insurance: "catInsurance",
    other: "catOther",
  };
  const key = map[category];
  return key ? t(key) : category;
}

export function splitMethodLabel(method: SplitMethod): string {
  if (method === "equal") return t("splitEqual");
  if (method === "custom_weight") return t("splitCustomWeight");
  return t("splitByArea");
}

export function groupTypeLabel(type: GroupType): string {
  const map: Record<GroupType, keyof (typeof strings)["el"]> = {
    building: "typeBuilding",
    school: "typeSchool",
    association: "typeAssociation",
    other: "typeOther",
  };
  return t(map[type]);
}
