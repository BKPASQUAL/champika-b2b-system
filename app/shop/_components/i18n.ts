/**
 * English / Sinhala for the shop. The English text is the key: t("Add to cart")
 * gives the Sinhala when the customer picked සිංහල, and the English otherwise.
 * Missing words simply stay in English. Use {name} for values: t("Save {amount}", { amount }).
 * Product names, brands and prices are never translated.
 */
export type Lang = "en" | "si";
export const LANG_COOKIE = "bkw_lang";

const SI: Record<string, string> = {
  // Header / navigation
  Home: "මුල් පිටුව",
  Shop: "භාණ්ඩ",
  Categories: "වර්ග",
  "All categories": "සියලුම වර්ග",
  "Quick Order": "ඉක්මන් ඇණවුම",
  "Quick order": "ඉක්මන් ඇණවුම",
  Quotation: "කොටේෂන්",
  "House quotation": "නිවසට කොටේෂන්",
  "My orders": "මගේ ඇණවුම්",
  Cart: "කරත්තය",
  Account: "ගිණුම",
  "Log in": "ඇතුල් වන්න",
  "Fast delivery in the Galle area": "ගාල්ල ප්‍රදේශයට ඉක්මන් ඩිලිවරි",
  "Search wires, switches… e.g. 1/113": "වයර්, ස්විච් සොයන්න… උදා: 1/113",
  "View all categories →": "සියලුම වර්ග බලන්න →",
  "Coming soon": "ළඟදීම",
  "{n} items": "භාණ්ඩ {n}",
  "1 item": "භාණ්ඩ 1",
  "Not sure what you need? Call": "මොනවද ඕනේ කියලා විශ්වාස නැද්ද? අමතන්න",
  "Light mode": "ආලෝක මාදිලිය",
  "Dark mode": "අඳුරු මාදිලිය",

  // Product cards
  "Add to cart": "කරත්තයට දාන්න",
  Add: "දාන්න",
  Added: "දැම්මා",
  "Added to cart": "කරත්තයට දැම්මා",
  "{n} added to cart": "{n}ක් කරත්තයට දැම්මා",
  "Ask for price": "මිල විමසන්න",
  "Save {amount}": "{amount} ඉතිරියි",
  "Call to order": "ඇණවුමට අමතන්න",
  "Contact for price": "මිල සඳහා අමතන්න",
  "Buy now": "දැන් මිලදී ගන්න",
  Quantity: "ප්‍රමාණය",

  // Home
  "Special": "විශේෂ",
  "Offers": "දීමනා",
  "Shop all": "සියලු භාණ්ඩ",
  "Best deals": "හොඳම දීමනා",
  "New arrivals": "අලුත් භාණ්ඩ",
  "Top picks": "ජනප්‍රිය භාණ්ඩ",
  "Just in": "අලුතින් ආපු",
  Brands: "සන්නාම",
  "Shop by brand": "සන්නාමය අනුව",
  "View all": "සියල්ල බලන්න",
  "Building or renovating?": "ගෙයක් හදනවද? අලුත්වැඩියා කරනවද?",
  "One price for your whole house.": "මුළු ගෙදරටම එක මිලක්.",
  "Whole-house wiring plan": "මුළු ගෙදරම වයරින් සැලැස්ම",
  "Tell us the rooms and the number of lights, plugs and fans. We will send a complete item list with our best discount.":
    "කාමර ගණන සහ ලයිට්, ප්ලග්, ෆෑන් ගණන අපට කියන්න. අපේ හොඳම වට්ටමත් එක්ක සම්පූර්ණ භාණ්ඩ ලැයිස්තුවක් අපි එවන්නම්.",
  "Ask for a quotation": "කොටේෂන් එකක් ඉල්ලන්න",
  "Our online shop is opening soon. Please check back shortly.": "අපේ ඔන්ලයින් කඩය ළඟදීම විවෘත වෙනවා.",

  "House wiring store · Galle area": "වයරින් භාණ්ඩ කඩය · ගාල්ල",
  "Wire your home with confidence.": "විශ්වාසයෙන් ඔබේ ගෙදර වයර් කරන්න.",
  "Genuine cables, switches, sockets and breakers at discount prices — delivered to your door.":
    "ඔරිජිනල් කේබල්, ස්විච්, සොකට් සහ බ්‍රේකර් වට්ටම් මිලට — ඔබේ ගෙදරටම.",
  "What do you need? e.g. 1/113 wire": "මොනවද ඕනේ? උදා: 1/113 වයර්",
  Search: "සොයන්න",
  "Shop now": "දැන් බලන්න",

  // Send your list
  "Have a list from your electrician?": "ඉලෙක්ට්‍රීෂන්ගෙන් ලැයිස්තුවක් තියෙනවද?",
  "Send a photo of your list": "ලැයිස්තුවේ ෆොටෝ එකක් එවන්න",
  "Take a photo of the paper list and send it. We will price every item and send you one quotation.":
    "කඩදාසි ලැයිස්තුවේ ෆොටෝ එකක් ගහලා එවන්න. හැම භාණ්ඩයකටම මිල දාලා අපි එක කොටේෂන් එකක් එවන්නම්.",
  "Send on WhatsApp": "WhatsApp එකෙන් එවන්න",
  "Upload photo": "ෆොටෝ එක දාන්න",
  "Get one price for your whole house": "මුළු ගෙදරටම එක මිලක් ගන්න",
  "We'll send a complete item list with our best discount — usually within one working day.":
    "අපේ හොඳම වට්ටමත් එක්ක සම්පූර්ණ භාණ්ඩ ලැයිස්තුවක් අපි එවන්නම් — සාමාන්‍යයෙන් එක වැඩ කරන දවසක් ඇතුළත.",
  "I have a list (photo)": "මට ලැයිස්තුවක් තියෙනවා (ෆොටෝ)",
  "Send a photo of your electrician's list": "ඉලෙක්ට්‍රීෂන්ගේ ලැයිස්තුවේ ෆොටෝ එකක් එවන්න",
  "Describe my house": "මගේ ගෙදර ගැන කියන්න",
  "Rooms, lights, plugs and fans": "කාමර, ලයිට්, ප්ලග්, ෆෑන්",
  "Photos of your list": "ලැයිස්තුවේ ෆොටෝ",
  "Clear photos of every page. You can add up to 5.": "හැම පිටුවකම පැහැදිලි ෆොටෝ. 5ක් දක්වා දාන්න පුළුවන්.",
  "Add another photo": "තව ෆොටෝ එකක් දාන්න",
  "Take or choose a photo": "ෆොටෝ එකක් ගන්න හෝ තෝරන්න",
  "Easier on WhatsApp?": "WhatsApp එකෙන් ලේසිද?",
  "Add a photo of your item list.": "ලැයිස්තුවේ ෆොටෝ එකක් දාන්න.",
  "About the job": "වැඩේ ගැන",
  "Anything else?": "වෙන මොනවා හරි?",
  "House plan or photos (optional, up to 5)": "ගෙදර ප්ලෑන් එක හෝ ෆොටෝ (අවශ්‍ය නම්, 5ක් දක්වා)",
  "Add plan / photo": "ප්ලෑන් / ෆොටෝ දාන්න",
  "Send my request": "මගේ ඉල්ලීම යවන්න",

  // Shop info / trust
  "Visit our shop": "අපේ කඩයට එන්න",
  "A real shop you can call and visit": "ඔබට කතා කරලා, ඇවිත් බලන්න පුළුවන් ඇත්ත කඩයක්",
  "Opening hours": "විවෘත වේලාවන්",
  Address: "ලිපිනය",
  "Get directions": "මග පෙන්වීම",
  "Call us": "අමතන්න",
  "We deliver to": "අපි ඩිලිවරි කරන ප්‍රදේශ",
  "Delivery fee": "ඩිලිවරි ගාස්තුව",
  "Free delivery over {amount}": "{amount}ට වැඩි ඇණවුම්වලට නොමිලේ ඩිලිවරි",
  "Free delivery": "නොමිලේ ඩිලිවරි",
  "Genuine brands": "ඔරිජිනල් සන්නාම",
  "Only original products from trusted makers": "විශ්වාසවන්ත නිෂ්පාදකයන්ගේ ඔරිජිනල් භාණ්ඩ පමණයි",
  "Cash on delivery": "භාණ්ඩ ලැබුණාම මුදල් ගෙවන්න",
  "Pay when the items reach your door": "භාණ්ඩ ගෙදරට ආවාම ගෙවන්න",
  "Galle area delivery": "ගාල්ල ප්‍රදේශයට ඩිලිවරි",
  "Fast doorstep delivery across Galle & suburbs": "ගාල්ල සහ අවට ප්‍රදේශවලට ඉක්මනින් ගෙදරටම",
  "Easy payment": "පහසු ගෙවීම",
  "Cash on delivery or bank transfer": "ලැබුණාම ගෙවීම හෝ බැංකු මාරුව",

  // WhatsApp
  "Chat on WhatsApp": "WhatsApp කරන්න",
  "Need help? Chat with us": "උදව් ඕනෙද? අපිත් එක්ක කතා කරන්න",
  "Order on WhatsApp": "WhatsApp එකෙන් ඇණවුම් කරන්න",

  // Footer
  Contact: "සම්බන්ධ වන්න",
  "All products": "සියලු භාණ්ඩ",
  "Everything you need to wire a house — cables, switches, sockets, breakers and boards — at fair prices, from one place.":
    "ගෙයක් වයරින් කරන්න ඕන හැමදේම — කේබල්, ස්විච්, සොකට්, බ්‍රේකර්, බෝඩ් — සාධාරණ මිලට, එකම තැනකින්.",
  "Contact details coming soon.": "සම්බන්ධතා විස්තර ළඟදීම.",
  "All rights reserved.": "සියලු හිමිකම් ඇවිරිණි.",

  // Cart
  "Your cart": "ඔබේ කරත්තය",
  "Your cart is empty": "ඔබේ කරත්තය හිස්",
  "Find cables, switches and everything else for your wiring job.": "වයරින් වැඩට ඕන කේබල්, ස්විච් සහ අනිත් හැමදේම හොයාගන්න.",
  "Start shopping": "මිලදී ගැනීම අරඹන්න",
  Subtotal: "උප එකතුව",
  Delivery: "ඩිලිවරි",
  Free: "නොමිලේ",
  Total: "එකතුව",
  Checkout: "ඇණවුම තහවුරු කරන්න",
  "Proceed to checkout": "ඇණවුම තහවුරු කරන්න",
  Remove: "ඉවත් කරන්න",
  "Order summary": "ඇණවුමේ සාරාංශය",
  "Or order by phone": "නැත්නම් දුරකථනයෙන් ඇණවුම් කරන්න",

  // Special order / cut pieces / advance
  "Special order": "විශේෂ ඇණවුම",
  "Special order item": "විශේෂ ඇණවුම් භාණ්ඩයක්",
  "about {time}": "දළ වශයෙන් {time}",
  "Cut to length": "අවශ්‍ය දිගට කපා",
  "We cut this to the length you order. Cut pieces can't be returned.": "ඔබ ඇණවුම් කරන දිගට අපි මෙය කපනවා. කපපු කෑලි ආපසු ගන්න බෑ.",
  "We order this from the supplier for you. After you place the order, we will contact you about an advance payment before we confirm it.":
    "අපි මෙය ඔබ වෙනුවෙන් සැපයුම්කරුගෙන් ගෙන්වනවා. ඇණවුම දැම්මට පස්සේ, තහවුරු කරන්න කලින් අත්තිකාරම් මුදලක් ගැන අපි ඔබව සම්බන්ධ කරගන්නවා.",
  "Ask on WhatsApp": "WhatsApp එකෙන් අහන්න",
  "Your order has special order items": "ඔබේ ඇණවුමේ විශේෂ ඇණවුම් භාණ්ඩ තියෙනවා",
  "We will contact you about an advance payment before we confirm the order.": "ඇණවුම තහවුරු කරන්න කලින් අත්තිකාරම් මුදලක් ගැන අපි ඔබව සම්බන්ධ කරගන්නවා.",
  "Advance payment": "අත්තිකාරම් මුදල",
  "Please pay an advance of {amount} so we can order your items.": "ඔබේ භාණ්ඩ ගෙන්වන්න {amount}ක අත්තිකාරම් මුදලක් ගෙවන්න.",
  "Advance received. Thank you!": "අත්තිකාරම ලැබුණා. ස්තූතියි!",
  "Slip received. We are checking it.": "ස්ලිප් එක ලැබුණා. අපි පරීක්ෂා කරනවා.",
  "Upload advance slip": "අත්තිකාරම් ස්ලිප් එක දාන්න",
  "Or pay at our shop.": "නැත්නම් අපේ කඩයට ඇවිත් ගෙවන්න.",

  // Orders
  "Order again": "ආයෙත් ඇණවුම් කරන්න",
  "Items added to your cart": "භාණ්ඩ කරත්තයට දැම්මා",

  // Login / guest
  "No account? Order with your phone number": "ගිණුමක් නැද්ද? ඔබේ දුරකථන අංකයෙන් ඇණවුම් කරන්න",
  "Continue without an account": "ගිණුමක් නැතුව ඉදිරියට",
  "You only need your name, phone number and address.": "ඔබේ නම, දුරකථන අංකය සහ ලිපිනය විතරයි ඕන.",

  "Welcome back": "ආයුබෝවන්",
  "Log in to order from {name}.": "{name} වෙතින් ඇණවුම් කිරීමට ඇතුල් වන්න.",
  "Create your account": "ගිණුමක් හදන්න",
  "Order online and track your deliveries.": "ඔන්ලයින් ඇණවුම් කරලා ඩිලිවරි එක බලාගන්න.",
  "Reset your password": "මුරපදය වෙනස් කරන්න",
  "We will email you a link to set a new password.": "අලුත් මුරපදයක් දාන්න ලින්ක් එකක් ඊමේල් කරන්නම්.",
  "Create account": "ගිණුමක් හදන්න",
  "Continue with Google": "Google එකෙන් ඉදිරියට",
  "or with email": "නැත්නම් ඊමේල් එකෙන්",
  "Your name": "ඔබේ නම",
  Email: "ඊමේල්",
  Password: "මුරපදය",
  "At least 6 characters.": "අවම අකුරු 6ක්.",
  "Forgot password?": "මුරපදය අමතකද?",
  "Send reset link": "ලින්ක් එක යවන්න",

  // Language
  Language: "භාෂාව",
};

export function translate(lang: Lang, en: string, vars?: Record<string, string | number>): string {
  let s = lang === "si" ? (SI[en] ?? en) : en;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

export type T = (en: string, vars?: Record<string, string | number>) => string;
export const makeT = (lang: Lang): T => (en, vars) => translate(lang, en, vars);
