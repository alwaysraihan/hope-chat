/**
 * Central translation strings for HopeChat.
 * Add new keys in both `en` and `bn` — the `useT()` hook returns the active language's object.
 */
const translations = {
  en: {
    // ── Bottom nav ─────────────────────────────────────────────────────────
    nav_chats:         'Chats',
    nav_stories:       'Stories',
    nav_notifications: 'Notifications',
    nav_menu:          'Menu',

    // ── Home ───────────────────────────────────────────────────────────────
    active:              'Active',
    stories:             'Stories',
    messages:            'Messages',
    requests:            'Requests',
    no_conversations:    'No conversations found',
    no_stories_chats:    'No stories yet for your chats.',

    // ── Search ─────────────────────────────────────────────────────────────
    search_placeholder:  'Search people…',
    recent_searches:     'Recent searches',
    edit:                'EDIT',
    suggested:           'Suggested',
    tab_all:             'All',
    tab_people:          'People',
    tab_messages_label:  'Messages',
    tab_groups:          'Groups',
    no_results:          'No results for',

    // ── Notifications ──────────────────────────────────────────────────────
    notifications:       'Notifications',
    no_notifications:    'No notifications yet',

    // ── Stories ────────────────────────────────────────────────────────────
    stories_title:       'Stories',
    stories_sub:         'Tap + Story to share yours',
    add_story:           'Add story',

    // ── Settings ───────────────────────────────────────────────────────────
    settings:                   'Settings',
    hopenity_account:           'Hopenity account',
    view_profile:               'View your profile',
    section_privacy:            'Privacy',
    read_receipts:              'Read receipts',
    read_receipts_sub:          "Show when you've read messages",
    message_permissions:        'Message permissions',
    message_permissions_sub:    'Control who can message you',
    typing_indicator:           'Typing indicator',
    typing_indicator_sub:       "Show when you're typing",
    disappearing_messages:      'Disappearing messages',
    disappearing_messages_sub:  'Messages delete automatically',
    section_notifications:      'Notifications',
    notification_sounds:        'Notification sounds',
    notification_sounds_sub:    'Ringtones and alert sounds',
    section_appearance:         'Appearance',
    theme:                      'Theme',
    theme_sub:                  'Light or dark mode',
    section_security:           'Security',
    blocked_people:             'Blocked people & pages',
    blocked_people_sub:         'Manage who you have blocked',
    report_problem:             'Report a problem',
    auto_save:                  'Auto-save photos',
    privacy_policy:             'Privacy Policy',
    coming_soon_title:          'Coming Soon!',
    coming_soon_body:           "This feature is coming soon.\nWait a few days — we’re cooking it\nup perfectly for you! 👨‍🍳",
    coming_soon_design:         'Design',
    coming_soon_build:          'Build',
    coming_soon_polish:         'Polish',
    got_it:                     'Got it!',

    // ── Blocked People ─────────────────────────────────────────────────────
    blocked_people_title:       'Blocked people',
    blocked_empty_title:        'No blocked accounts',
    blocked_empty_body:         'People and pages you block will appear here.',
    blocked_label:              'Blocked',
    unblock:                    'Unblock',
    blocked_count_one:          'blocked account',
    blocked_count_many:         'blocked accounts',

    // ── Message Requests ───────────────────────────────────────────────────
    message_requests:           'Message requests',
    tab_you_may_know:           'YOU MAY KNOW',
    tab_spam:                   'SPAM',
    signin_to_see_requests:     'Sign in to see message requests.',
    spam_empty:                 'Spam and filtered requests will appear here. Nothing to show yet.',
    requests_info:              'Open a chat to learn more about who sent it. Tap Accept on a row to move the conversation into your inbox.',
    no_pending_requests:        'No pending message requests.',
    accept:                     'Accept',
    delete_request:             'Delete request',
    delete_all_requests:        'Delete all requests',
    delete_all_confirm:         'This will remove all pending message requests.',
    delete:                     'Delete',
    cancel:                     'Cancel',

    // ── Login ──────────────────────────────────────────────────────────────
    app_name:                   'Hope Chat',
    login_subtitle:             'Sign in with your Hopenity account.',
    checking_session:           'Checking Hopenity session…',
    continue_as:                'Continue as',
    refresh_session:            'Refresh session',
    sign_in_required:           'Sign in required',
    sign_in_instructions:       'Open Hopenity and log in once. Come back here and tap Refresh session. If the app is not installed yet, download it below.',
    install_from_store:         'Install Hopenity from Play Store',
    open_hopenity:              'Open Hopenity to sign in',
    get_from_store:             'Get app from Store',
    login_with_email:           'Login with email or phone',
    session_expired_title:      'Session not valid',
    session_expired_body:       'This Hopenity sign-in is expired or was signed out. Open Hopenity, log in again, then tap Refresh session here.',
    no_internet_title:          'Cannot verify session',
    no_internet_body:           'Check your internet connection and try again.',

    // ── Incoming Call ──────────────────────────────────────────────────────
    incoming_audio_call:        'Incoming audio call',
    incoming_video_call:        'Incoming video call',
    decline_call:               'Decline call',
    accept_call:                'Accept call',

    // ── Create Story ───────────────────────────────────────────────────────
    create_story:               'Create Story',
    public:                     'Public',
    friends:                    'Friends',
    post:                       'Post',
    select_music:               'Select Music',
    search_music:               'Search music…',
    no_music:                   'No music available',
    remove_music:               'Remove music',
    tab_background:             'Background',
    tab_gallery:                'Gallery',
    tab_photo:                  'Photo',
    write_something:            'Write something…',
    get_started_hint:           'Choose an option below to get started',
    story_posted:               'Story posted!',
    story_live:                 'Your story is live.',
    failed:                     'Failed',
    story_failed:               'Could not post your story. Please try again.',

    // ── Archive ────────────────────────────────────────────────────────────
    archive:                    'Archive',
    no_archived_chats:          'No archived chats',
    archived_empty_body:        'Archived conversations will appear here when that folder is available from your account.',

    // ── Edit Search History ────────────────────────────────────────────────
    edit_search_history:        'Edit search history',
    edit_search_note:           'Changes will only apply to your recent searches list, which is from your history on this device.',
    clear_all:                  'CLEAR ALL',

    // ── Menu / Common ──────────────────────────────────────────────────────
    menu:                       'Menu',
    archive_label:              'Archive',
    friend_requests:            'Friend requests',
    language:                   'Language',
    english:                    'English',
    bangla:                     'বাংলা',
    logout:                     'Log out',
    logout_confirm_title:       'Log out',
    logout_confirm_message:     'Are you sure you want to log out?',
    message_requests_label:     'Message requests',
  },

  bn: {
    // ── Bottom nav ─────────────────────────────────────────────────────────
    nav_chats:         'চ্যাট',
    nav_stories:       'স্টোরি',
    nav_notifications: 'বিজ্ঞপ্তি',
    nav_menu:          'মেনু',

    // ── Home ───────────────────────────────────────────────────────────────
    active:              'সক্রিয়',
    stories:             'স্টোরি',
    messages:            'বার্তা',
    requests:            'অনুরোধ',
    no_conversations:    'কোনো কথোপকথন পাওয়া যায়নি',
    no_stories_chats:    'আপনার চ্যাটে এখনো কোনো স্টোরি নেই।',

    // ── Search ─────────────────────────────────────────────────────────────
    search_placeholder:  'মানুষ খুঁজুন…',
    recent_searches:     'সাম্প্রতিক অনুসন্ধান',
    edit:                'সম্পাদনা',
    suggested:           'প্রস্তাবিত',
    tab_all:             'সব',
    tab_people:          'মানুষ',
    tab_messages_label:  'বার্তা',
    tab_groups:          'গ্রুপ',
    no_results:          'কোনো ফলাফল নেই',

    // ── Notifications ──────────────────────────────────────────────────────
    notifications:       'বিজ্ঞপ্তি',
    no_notifications:    'এখনো কোনো বিজ্ঞপ্তি নেই',

    // ── Stories ────────────────────────────────────────────────────────────
    stories_title:       'স্টোরি',
    stories_sub:         'শেয়ার করতে + Story চাপুন',
    add_story:           'স্টোরি যোগ করুন',

    // ── Settings ───────────────────────────────────────────────────────────
    settings:                   'সেটিংস',
    hopenity_account:           'Hopenity অ্যাকাউন্ট',
    view_profile:               'আপনার প্রোফাইল দেখুন',
    section_privacy:            'গোপনীয়তা',
    read_receipts:              'পঠন রসিদ',
    read_receipts_sub:          'আপনি বার্তা পড়লে দেখান',
    message_permissions:        'বার্তা অনুমতি',
    message_permissions_sub:    'কে আপনাকে বার্তা পাঠাতে পারবে নিয়ন্ত্রণ করুন',
    typing_indicator:           'টাইপিং সূচক',
    typing_indicator_sub:       'আপনি টাইপ করলে দেখান',
    disappearing_messages:      'অদৃশ্য বার্তা',
    disappearing_messages_sub:  'বার্তা স্বয়ংক্রিয়ভাবে মুছে যায়',
    section_notifications:      'বিজ্ঞপ্তি',
    notification_sounds:        'বিজ্ঞপ্তির শব্দ',
    notification_sounds_sub:    'রিংটোন এবং সতর্কতার শব্দ',
    section_appearance:         'চেহারা',
    theme:                      'থিম',
    theme_sub:                  'লাইট বা ডার্ক মোড',
    section_security:           'নিরাপত্তা',
    blocked_people:             'ব্লক করা মানুষ ও পেজ',
    blocked_people_sub:         'আপনি যাদের ব্লক করেছেন তা পরিচালনা করুন',
    report_problem:             'সমস্যা রিপোর্ট করুন',
    auto_save:                  'ছবি স্বয়ংক্রিয় সংরক্ষণ',
    privacy_policy:             'গোপনীয়তা নীতি',
    coming_soon_title:          'শীঘ্রই আসছে!',
    coming_soon_body:           "এই ফিচারটি শীঘ্রই আসবে।\nকয়েক দিন অপেক্ষা করুন — আমরা আপনার জন্য রান্না করছি! 👨‍🍳",
    coming_soon_design:         'ডিজাইন',
    coming_soon_build:          'তৈরি',
    coming_soon_polish:         'সমাপ্তি',
    got_it:                     'বুঝেছি!',

    // ── Blocked People ─────────────────────────────────────────────────────
    blocked_people_title:       'ব্লক করা মানুষ',
    blocked_empty_title:        'কোনো ব্লক করা অ্যাকাউন্ট নেই',
    blocked_empty_body:         'আপনি যাদের ব্লক করবেন তারা এখানে দেখাবে।',
    blocked_label:              'ব্লক করা',
    unblock:                    'আনব্লক',
    blocked_count_one:          'ব্লক করা অ্যাকাউন্ট',
    blocked_count_many:         'ব্লক করা অ্যাকাউন্ট',

    // ── Message Requests ───────────────────────────────────────────────────
    message_requests:           'মেসেজ অনুরোধ',
    tab_you_may_know:           'আপনি চিনতে পারেন',
    tab_spam:                   'স্প্যাম',
    signin_to_see_requests:     'মেসেজ অনুরোধ দেখতে সাইন ইন করুন।',
    spam_empty:                 'স্প্যাম এবং ফিল্টার করা অনুরোধ এখানে দেখাবে। এখন কিছু নেই।',
    requests_info:              'কে পাঠায় তা জানতে চ্যাট খুলুন। অ্যাক্সেপ্ট চাপুন।',
    no_pending_requests:        'কোনো বিচারাধীন মেসেজ অনুরোধ নেই।',
    accept:                     'গ্রহণ',
    delete_request:             'অনুরোধ মুছুন',
    delete_all_requests:        'সব অনুরোধ মুছুন',
    delete_all_confirm:         'এটি সব বিচারাধীন মেসেজ অনুরোধ সরাবে।',
    delete:                     'মুছুন',
    cancel:                     'বাতিল',

    // ── Login ──────────────────────────────────────────────────────────────
    app_name:                   'Hope Chat',
    login_subtitle:             'আপনার Hopenity অ্যাকাউন্ট দিয়ে সাইন ইন করুন।',
    checking_session:           'Hopenity সেশন যাচাই হচ্ছে…',
    continue_as:                'যেতে থাকুন',
    refresh_session:            'সেশন রিফ্রেশ',
    sign_in_required:           'সাইন ইন প্রয়োজন',
    sign_in_instructions:       'Hopenity খুলে লগ ইন করুন। ফিরে এসে রিফ্রেশ সেশন চাপুন।',
    install_from_store:         'Play Store থেকে Hopenity ইনস্টল করুন',
    open_hopenity:              'সাইন ইন করতে Hopenity খুলুন',
    get_from_store:             'স্টোর থেকে অ্যাপ নিন',
    login_with_email:           'ইমেইল বা ফোন দিয়ে লগইন',
    session_expired_title:      'সেশন সঠিক নয়',
    session_expired_body:       'এই Hopenity সাইনিন মেয়াদ শেষ বা সাইন আউট হয়েছে। Hopenity খুলুন, পুনরায় লগ ইন করুন।',
    no_internet_title:          'সেশন যাচাই করা যাচ্ছে না',
    no_internet_body:           'আপনার ইন্টারনেট সংযোগ যাচাই করুন।',

    // ── Incoming Call ──────────────────────────────────────────────────────
    incoming_audio_call:        'আসছে অডিও কল',
    incoming_video_call:        'আসছে ভিডিও কল',
    decline_call:               'কল প্রত্যাখ্যান',
    accept_call:                'কল গ্রহণ',

    // ── Create Story ───────────────────────────────────────────────────────
    create_story:               'স্টোরি তৈরি করুন',
    public:                     'পাবলিক',
    friends:                    'বন্ধুরা',
    post:                       'পোস্ট',
    select_music:               'মিউজিক নির্বাচন করুন',
    search_music:               'মিউজিক খুঁজুন…',
    no_music:                   'কোনো মিউজিক নেই',
    remove_music:               'মিউজিক সরান',
    tab_background:             'ব্যাকগ্রাউন্ড',
    tab_gallery:                'গ্যালারি',
    tab_photo:                  'ফটো',
    write_something:            'কিছু লিখুন…',
    get_started_hint:           'শুরু করতে নিচে একটি বিকল্প বেছে নিন',
    story_posted:               'স্টোরি পোস্ট হয়েছে!',
    story_live:                 'আপনার স্টোরি লাইভ।',
    failed:                     'ব্যর্থ',
    story_failed:               'স্টোরি পোস্ট করা যায়নি। আবার চেষ্টা করুন।',

    // ── Archive ────────────────────────────────────────────────────────────
    archive:                    'আর্কাইভ',
    no_archived_chats:          'কোনো আর্কাইভ চ্যাট নেই',
    archived_empty_body:        'আপনার অ্যাকাউন্ট থেকে ফোল্ডার পাওয়া গেলে আর্কাইভ হওয়া কথোপকথন এখানে দেখাবে।',

    // ── Edit Search History ────────────────────────────────────────────────
    edit_search_history:        'অনুসন্ধান ইতিহাস সম্পাদনা',
    edit_search_note:           'পরিবর্তনগুলো কেবল এই ডিভাইসের ইতিহাসের সাম্প্রতিক অনুসন্ধান তালিকায় প্রয়োগ হবে।',
    clear_all:                  'সব মুছুন',

    // ── Menu / Common ──────────────────────────────────────────────────────
    menu:                       'মেনু',
    archive_label:              'আর্কাইভ',
    friend_requests:            'বন্ধুত্বের অনুরোধ',
    language:                   'ভাষা',
    english:                    'English',
    bangla:                     'বাংলা',
    logout:                     'লগ আউট',
    logout_confirm_title:       'লগ আউট',
    logout_confirm_message:     'আপনি কি সত্যিই লগ আউট করতে চান?',
    message_requests_label:     'মেসেজ অনুরোধ',
  },
} as const;

export type TranslationKey = keyof typeof translations.en;
export type Translations = typeof translations.en;
export { translations };
