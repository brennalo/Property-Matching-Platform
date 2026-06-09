export interface PlaceTypeOption { value: string; label: string; emoji: string }

// ── Popular quick-pick chips ──────────────────────────────────────────────────

export const POPULAR_PLACE_TYPES: PlaceTypeOption[] = [
    { value: 'cafe', label: 'Café', emoji: '☕' },
    { value: 'gym', label: 'Gym', emoji: '🏋️' },
    { value: 'restaurant', label: 'Restaurant', emoji: '🍽️' },
    { value: 'supermarket', label: 'Supermarket', emoji: '🛒' },
    { value: 'pharmacy', label: 'Pharmacy', emoji: '💊' },
    { value: 'hospital', label: 'Hospital', emoji: '🏥' },
    { value: 'park', label: 'Park', emoji: '🌳' },
    { value: 'school', label: 'School', emoji: '🏫' },
    { value: 'library', label: 'Library', emoji: '📚' },
    { value: 'shopping_mall', label: 'Shopping Mall', emoji: '🛍️' },
    { value: 'night_club', label: 'Nightclub', emoji: '🎵' },
    { value: 'bar', label: 'Bar', emoji: '🍺' },
    { value: 'convenience_store', label: 'Convenience Store', emoji: '🏪' },
    { value: 'movie_theater', label: 'Cinema', emoji: '🎬' },
    { value: 'laundry', label: 'Laundry', emoji: '👕' },
    { value: 'atm', label: 'ATM', emoji: '🏧' },
]

// ── Full Google Places (New) taxonomy ─────────────────────────────────────────

export const ALL_PLACE_TYPES: PlaceTypeOption[] = [
    // Food & drink
    { value: 'american_restaurant', label: 'American Restaurant', emoji: '🍔' },
    { value: 'bakery', label: 'Bakery', emoji: '🥐' },
    { value: 'bar', label: 'Bar', emoji: '🍺' },
    { value: 'barbecue_restaurant', label: 'BBQ Restaurant', emoji: '🥩' },
    { value: 'brazilian_restaurant', label: 'Brazilian Restaurant', emoji: '🇧🇷' },
    { value: 'breakfast_restaurant', label: 'Breakfast Restaurant', emoji: '🍳' },
    { value: 'brunch_restaurant', label: 'Brunch Restaurant', emoji: '🥞' },
    { value: 'cafe', label: 'Café', emoji: '☕' },
    { value: 'chinese_restaurant', label: 'Chinese Restaurant', emoji: '🥟' },
    { value: 'coffee_shop', label: 'Coffee Shop', emoji: '☕' },
    { value: 'fast_food_restaurant', label: 'Fast Food', emoji: '🍟' },
    { value: 'french_restaurant', label: 'French Restaurant', emoji: '🥖' },
    { value: 'greek_restaurant', label: 'Greek Restaurant', emoji: '🫒' },
    { value: 'hamburger_restaurant', label: 'Burger Joint', emoji: '🍔' },
    { value: 'ice_cream_shop', label: 'Ice Cream Shop', emoji: '🍦' },
    { value: 'indian_restaurant', label: 'Indian Restaurant', emoji: '🍛' },
    { value: 'indonesian_restaurant', label: 'Indonesian Restaurant', emoji: '🍜' },
    { value: 'italian_restaurant', label: 'Italian Restaurant', emoji: '🍝' },
    { value: 'japanese_restaurant', label: 'Japanese Restaurant', emoji: '🍣' },
    { value: 'juice_shop', label: 'Juice Shop', emoji: '🥤' },
    { value: 'korean_restaurant', label: 'Korean Restaurant', emoji: '🥘' },
    { value: 'lebanese_restaurant', label: 'Lebanese Restaurant', emoji: '🧆' },
    { value: 'meal_delivery', label: 'Meal Delivery', emoji: '🛵' },
    { value: 'meal_takeaway', label: 'Takeaway', emoji: '📦' },
    { value: 'mediterranean_restaurant', label: 'Mediterranean Restaurant', emoji: '🫙' },
    { value: 'mexican_restaurant', label: 'Mexican Restaurant', emoji: '🌮' },
    { value: 'middle_eastern_restaurant', label: 'Middle Eastern Restaurant', emoji: '🧿' },
    { value: 'night_club', label: 'Nightclub', emoji: '🎵' },
    { value: 'pizza_restaurant', label: 'Pizza Restaurant', emoji: '🍕' },
    { value: 'ramen_restaurant', label: 'Ramen Restaurant', emoji: '🍜' },
    { value: 'restaurant', label: 'Restaurant', emoji: '🍽️' },
    { value: 'sandwich_shop', label: 'Sandwich Shop', emoji: '🥪' },
    { value: 'seafood_restaurant', label: 'Seafood Restaurant', emoji: '🦞' },
    { value: 'spanish_restaurant', label: 'Spanish Restaurant', emoji: '🥘' },
    { value: 'steak_house', label: 'Steakhouse', emoji: '🥩' },
    { value: 'sushi_restaurant', label: 'Sushi Restaurant', emoji: '🍱' },
    { value: 'thai_restaurant', label: 'Thai Restaurant', emoji: '🍲' },
    { value: 'turkish_restaurant', label: 'Turkish Restaurant', emoji: '🥙' },
    { value: 'vegan_restaurant', label: 'Vegan Restaurant', emoji: '🥗' },
    { value: 'vegetarian_restaurant', label: 'Vegetarian Restaurant', emoji: '🥦' },
    { value: 'vietnamese_restaurant', label: 'Vietnamese Restaurant', emoji: '🍜' },
    // Health & fitness
    { value: 'athletic_field', label: 'Athletic Field', emoji: '🏟️' },
    { value: 'fitness_center', label: 'Fitness Center', emoji: '🏋️' },
    { value: 'gym', label: 'Gym', emoji: '🏋️' },
    { value: 'hospital', label: 'Hospital', emoji: '🏥' },
    { value: 'medical_lab', label: 'Medical Lab', emoji: '🔬' },
    { value: 'pharmacy', label: 'Pharmacy', emoji: '💊' },
    { value: 'physiotherapist', label: 'Physiotherapist', emoji: '🦴' },
    { value: 'spa', label: 'Spa', emoji: '🧖' },
    { value: 'sports_club', label: 'Sports Club', emoji: '⚽' },
    { value: 'sports_complex', label: 'Sports Complex', emoji: '🏟️' },
    { value: 'swimming_pool', label: 'Swimming Pool', emoji: '🏊' },
    { value: 'wellness_center', label: 'Wellness Center', emoji: '🧘' },
    { value: 'yoga_studio', label: 'Yoga Studio', emoji: '🧘' },
    // Shopping & retail
    { value: 'auto_parts_store', label: 'Auto Parts Store', emoji: '🔧' },
    { value: 'bicycle_store', label: 'Bicycle Store', emoji: '🚲' },
    { value: 'book_store', label: 'Book Store', emoji: '📖' },
    { value: 'cell_phone_store', label: 'Phone Store', emoji: '📱' },
    { value: 'clothing_store', label: 'Clothing Store', emoji: '👗' },
    { value: 'convenience_store', label: 'Convenience Store', emoji: '🏪' },
    { value: 'department_store', label: 'Department Store', emoji: '🏬' },
    { value: 'electronics_store', label: 'Electronics Store', emoji: '💻' },
    { value: 'florist', label: 'Florist', emoji: '💐' },
    { value: 'furniture_store', label: 'Furniture Store', emoji: '🛋️' },
    { value: 'gift_shop', label: 'Gift Shop', emoji: '🎁' },
    { value: 'grocery_store', label: 'Grocery Store', emoji: '🛒' },
    { value: 'hardware_store', label: 'Hardware Store', emoji: '🔨' },
    { value: 'home_goods_store', label: 'Home Goods Store', emoji: '🏠' },
    { value: 'jewelry_store', label: 'Jewellery Store', emoji: '💍' },
    { value: 'market', label: 'Market', emoji: '🏪' },
    { value: 'pet_store', label: 'Pet Store', emoji: '🐾' },
    { value: 'shoe_store', label: 'Shoe Store', emoji: '👟' },
    { value: 'shopping_mall', label: 'Shopping Mall', emoji: '🛍️' },
    { value: 'sporting_goods_store', label: 'Sporting Goods Store', emoji: '🏅' },
    { value: 'supermarket', label: 'Supermarket', emoji: '🛒' },
    // Education & culture
    { value: 'art_gallery', label: 'Art Gallery', emoji: '🖼️' },
    { value: 'community_center', label: 'Community Center', emoji: '🏛️' },
    { value: 'library', label: 'Library', emoji: '📚' },
    { value: 'movie_theater', label: 'Cinema', emoji: '🎬' },
    { value: 'museum', label: 'Museum', emoji: '🏛️' },
    { value: 'performing_arts_theater', label: 'Theatre', emoji: '🎭' },
    { value: 'preschool', label: 'Preschool', emoji: '🧒' },
    { value: 'primary_school', label: 'Primary School', emoji: '🏫' },
    { value: 'school', label: 'School', emoji: '🏫' },
    { value: 'secondary_school', label: 'Secondary School', emoji: '🏫' },
    { value: 'university', label: 'University', emoji: '🎓' },
    // Outdoor & nature
    { value: 'campground', label: 'Campground', emoji: '⛺' },
    { value: 'dog_park', label: 'Dog Park', emoji: '🐕' },
    { value: 'hiking_area', label: 'Hiking Area', emoji: '🥾' },
    { value: 'national_park', label: 'National Park', emoji: '🏞️' },
    { value: 'park', label: 'Park', emoji: '🌳' },
    { value: 'playground', label: 'Playground', emoji: '🛝' },
    // Services & transport
    { value: 'atm', label: 'ATM', emoji: '🏧' },
    { value: 'bank', label: 'Bank', emoji: '🏦' },
    { value: 'bus_station', label: 'Bus Station', emoji: '🚌' },
    { value: 'car_wash', label: 'Car Wash', emoji: '🚿' },
    { value: 'courier_service', label: 'Courier Service', emoji: '📦' },
    { value: 'dentist', label: 'Dentist', emoji: '🦷' },
    { value: 'doctor', label: 'Doctor / Clinic', emoji: '👨‍⚕️' },
    { value: 'electric_vehicle_charging_station', label: 'EV Charging', emoji: '⚡' },
    { value: 'gas_station', label: 'Petrol Station', emoji: '⛽' },
    { value: 'hair_salon', label: 'Hair Salon', emoji: '✂️' },
    { value: 'laundry', label: 'Laundry', emoji: '👕' },
    { value: 'lawyer', label: 'Law Firm', emoji: '⚖️' },
    { value: 'light_rail_station', label: 'LRT Station', emoji: '🚇' },
    { value: 'money_transfer', label: 'Money Transfer', emoji: '💸' },
    { value: 'mosque', label: 'Mosque', emoji: '🕌' },
    { value: 'nail_salon', label: 'Nail Salon', emoji: '💅' },
    { value: 'parking', label: 'Parking', emoji: '🅿️' },
    { value: 'place_of_worship', label: 'Place of Worship', emoji: '🕍' },
    { value: 'post_office', label: 'Post Office', emoji: '📮' },
    { value: 'real_estate_agency', label: 'Real Estate Agency', emoji: '🏘️' },
    { value: 'subway_station', label: 'MRT / Subway Station', emoji: '🚇' },
    { value: 'taxi_stand', label: 'Taxi Stand', emoji: '🚕' },
    { value: 'train_station', label: 'Train Station', emoji: '🚉' },
    { value: 'transit_station', label: 'Transit Hub', emoji: '🚏' },
    { value: 'veterinary_care', label: 'Vet', emoji: '🐾' },
]

// ── Colour map for known popular types ────────────────────────────────────────

const KNOWN_COLORS: Record<string, string> = {
    cafe: '#8B4513', gym: '#1565C0', restaurant: '#E65100',
    supermarket: '#2E7D32', pharmacy: '#6A1B9A', hospital: '#C62828',
    park: '#388E3C', school: '#F57F17', library: '#4527A0',
    shopping_mall: '#AD1457', night_club: '#283593', bar: '#4E342E',
    convenience_store: '#00695C', movie_theater: '#6D4C41',
    laundry: '#0277BD', atm: '#558B2F',
}

// Deterministic hash → a visually distinct, dark-enough HSL colour.
// Same type value always produces the same colour across sessions.
function hashColor(str: string): string {
    let h = 0
    for (let i = 0; i < str.length; i++) {
        h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
    }
    const hue = Math.abs(h) % 360
    return `hsl(${hue}, 60%, 35%)`
}

export function getPlaceTypeColor(type: string): string {
    return KNOWN_COLORS[type] ?? hashColor(type)
}

// ── Label lookup ──────────────────────────────────────────────────────────────

const LABEL_MAP: Record<string, string> = Object.fromEntries(
    ALL_PLACE_TYPES.map(o => [o.value, o.label])
)

export function getPlaceTypeLabel(type: string): string {
    return LABEL_MAP[type] ?? type
}

// ── Search helper — word-boundary prefix match ────────────────────────────────
// "ba" matches "Bakery", "Bar", "Bank" (word starts) but NOT "Brunch Restaurant"

export function searchPlaceTypes(query: string, limit = 8): PlaceTypeOption[] {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return ALL_PLACE_TYPES.filter(o => {
        // Match start of label (e.g. "ba" → "Bakery")
        if (o.label.toLowerCase().startsWith(q)) return true
        // Match start of any word in label (e.g. "re" → "Ramen Restaurant", "Real Estate Agency")
        if (o.label.toLowerCase().split(' ').some(w => w.startsWith(q))) return true
        // Match start of value key (e.g. "bakery" or "bak")
        if (o.value.startsWith(q)) return true
        // Match start of any word in value key, split on underscore
        if (o.value.split('_').some(w => w.startsWith(q))) return true
        return false
    }).slice(0, limit)
}

// Backward-compat alias
export const PLACE_TYPE_OPTIONS = POPULAR_PLACE_TYPES
