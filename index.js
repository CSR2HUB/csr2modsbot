require('dotenv').config()
const TelegramBot = require('node-telegram-bot-api')
const express = require('express')
const bodyParser = require('body-parser')
const fs = require('fs')
const Papa = require('papaparse') // Add papaparse to package.json

const token = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN
const adminChatId = process.env.ADMIN_CHAT_ID
const port = process.env.PORT || 8695

// Create bot instance
const bot = new TelegramBot(token, { polling: true })

// Set persistent Telegram menu commands
bot.setMyCommands([
  { command: 'start', description: 'Start the bot and view main menu' },
  { command: 'menu', description: 'Browse CSR2 categories' },
  { command: 'cart', description: 'View your cart' },
  { command: 'search', description: 'Search for specific cars' },
  { command: 'brands', description: 'Browse by car brands' },
  { command: 'help', description: 'Customer support & FAQ' }
]).catch(console.error)

const app = express()
app.use(bodyParser.json())

// User sessions to store cart data
const userSessions = new Map()

// Cars database - will be loaded from CSV
let carsDatabase = new Map()
const carsByBrand = new Map()
let carCategories = {}

// Load cars from CSV file
async function loadCarsDatabase () {
  try {
    console.log('Loading cars database from CSV...')
    const csvContent = fs.readFileSync('Gold Latest 116  Sheet1 5.csv', 'utf8')

    const parsed = Papa.parse(csvContent, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true
    })

    const uniqueCars = new Map()
    const brandCount = new Map()

    parsed.data.forEach((row, index) => {
      if (row.Handle && row.Title) {
        const carId = row.Handle

        if (!uniqueCars.has(carId)) {
          // Extract brand from title
          const titleParts = row.Title.split(' ')
          let brand = 'Other'
          if (titleParts.length >= 3 && titleParts[0] === 'CSR2') {
            brand = titleParts[1]
          }

          const car = {
            id: carId,
            name: row.Title,
            brand,
            price: row['Price / United States'] || 10,
            description: `Premium CSR2 car - ${row.Title}. Get this amazing vehicle added to your garage!`,
            image: row['Image Src'] || 'csr2-car-default.webp',
            vendor: row.Vendor || 'CSR2 MODS STORE',
            tags: row.Tags || '',
            published: row.Published === 'TRUE',
            variants: []
          }

          // Add variant if exists
          if (row['Option1 Value']) {
            car.variants.push({
              color: row['Option1 Value'],
              price: row['Price / United States'] || 10,
              sku: row['Variant SKU'] || ''
            })
          }

          uniqueCars.set(carId, car)

          // Count by brand
          brandCount.set(brand, (brandCount.get(brand) || 0) + 1)
        } else {
          // Add additional variant to existing car
          if (row['Option1 Value']) {
            uniqueCars.get(carId).variants.push({
              color: row['Option1 Value'],
              price: row['Price / United States'] || 10,
              sku: row['Variant SKU'] || ''
            })
          }
        }
      }
    })

    // Store in global variables
    carsDatabase = uniqueCars

    // Organize by brands
    carsByBrand.clear()
    Array.from(uniqueCars.values()).forEach(car => {
      if (!carsByBrand.has(car.brand)) {
        carsByBrand.set(car.brand, [])
      }
      carsByBrand.get(car.brand).push(car)
    })

    // Create categories
    carCategories = {
      luxury: Array.from(uniqueCars.values()).filter(car =>
        ['Bugatti', 'McLaren', 'Lamborghini', 'Ferrari', 'Koenigsegg', 'Pagani', 'Rolls-Royce'].includes(car.brand)
      ),
      sports: Array.from(uniqueCars.values()).filter(car =>
        ['Porsche', 'BMW', 'Mercedes-Benz', 'Audi', 'Aston'].includes(car.brand)
      ),
      american: Array.from(uniqueCars.values()).filter(car =>
        ['Ford', 'Chevrolet', 'Dodge', 'Cadillac', 'Hennessey'].includes(car.brand)
      ),
      japanese: Array.from(uniqueCars.values()).filter(car =>
        ['Nissan', 'Toyota', 'Honda', 'Mazda', 'Subaru', 'Lexus', 'Acura'].includes(car.brand)
      ),
      all: Array.from(uniqueCars.values())
    }

    console.log(`✅ Loaded ${uniqueCars.size} unique cars from ${parsed.data.length} rows`)
    console.log(`✅ Found ${carsByBrand.size} brands`)
    console.log(`✅ Categories: Luxury (${carCategories.luxury.length}), Sports (${carCategories.sports.length}), American (${carCategories.american.length}), Japanese (${carCategories.japanese.length})`)

    return true
  } catch (error) {
    console.error('❌ Failed to load cars database:', error.message)
    console.log('📝 Using fallback static car data...')
    createFallbackCarData()
    return false
  }
}

// Fallback car data if CSV loading fails
function createFallbackCarData () {
  const fallbackCars = [
    { id: 'bugatti-chiron', name: 'CSR2 Bugatti Chiron', brand: 'Bugatti', price: 15, description: 'Ultimate hypercar', image: 'csr2-car-bugatti.webp' },
    { id: 'mclaren-720s', name: 'CSR2 McLaren 720S', brand: 'McLaren', price: 12, description: 'British supercar', image: 'csr2-car-mclaren.webp' },
    { id: 'lamborghini-huracan', name: 'CSR2 Lamborghini Huracán', brand: 'Lamborghini', price: 14, description: 'Italian beast', image: 'csr2-car-lambo.webp' }
  ]

  carsDatabase = new Map()
  fallbackCars.forEach(car => {
    carsDatabase.set(car.id, car)
  })

  carCategories = {
    luxury: fallbackCars,
    all: fallbackCars
  }
}

// CSR2 MODS STORE Menu data with real cars integration
const menuCategories = {
  csr2_cars_luxury: {
    name: '🏆 LUXURY CARS',
    emoji: '🏆',
    getCars: () => carCategories.luxury?.slice(0, 20) || []
  },
  csr2_cars_sports: {
    name: '🏁 SPORTS CARS',
    emoji: '🏁',
    getCars: () => carCategories.sports?.slice(0, 20) || []
  },
  csr2_cars_american: {
    name: '🇺🇸 AMERICAN CARS',
    emoji: '🇺🇸',
    getCars: () => carCategories.american?.slice(0, 20) || []
  },
  csr2_cars_japanese: {
    name: '🇯🇵 JAPANESE CARS',
    emoji: '🇯🇵',
    getCars: () => carCategories.japanese?.slice(0, 20) || []
  },
  csr2_cars_all: {
    name: '🏎️ ALL CARS',
    emoji: '🏎️',
    getCars: () => carCategories.all?.slice(0, 50) || []
  },
  // Keep existing categories
  csr2_topups: {
    name: '💰 CSR2 TOP UPS',
    emoji: '💰',
    items: [
      { id: 'cash_5m', name: '5,000,000 Cash', price: 1.99, description: '5 million in-game cash - Budget starter', image: 'csr2-cash-5m.webp' },
      { id: 'cash_10m', name: '10,000,000 Cash', price: 2.99, description: '10 million in-game cash - Starter package', image: 'csr2-cash-10m.webp' },
      { id: 'cash_25m', name: '25,000,000 Cash', price: 5.99, description: '25 million in-game cash - Popular choice', image: 'csr2-cash-25m.webp' },
      { id: 'cash_50m', name: '50,000,000 Cash', price: 9.99, description: '50 million in-game cash - Best value', image: 'csr2-cash-50m.webp' },
      { id: 'cash_75m', name: '75,000,000 Cash', price: 13.99, description: '75 million in-game cash - Premium tier', image: 'csr2-cash-75m.webp' },
      { id: 'cash_100m', name: '100,000,000 Cash', price: 16.99, description: '100 million in-game cash - Maximum package', image: 'csr2-cash-100m.webp' },
      { id: 'gold_5k', name: '5,000 Gold', price: 1.99, description: '5,000 gold coins - Budget starter', image: 'csr2-gold-5k.webp' },
      { id: 'gold_10k', name: '10,000 Gold', price: 2.99, description: '10,000 gold coins - Entry level', image: 'csr2-gold-10k.webp' },
      { id: 'gold_25k', name: '25,000 Gold', price: 5.99, description: '25,000 gold coins - Popular choice', image: 'csr2-gold-25k.webp' },
      { id: 'gold_50k', name: '50,000 Gold', price: 9.99, description: '50,000 gold coins - Great value', image: 'csr2-gold-50k.webp' },
      { id: 'gold_75k', name: '75,000 Gold', price: 13.99, description: '75,000 gold coins - Premium tier', image: 'csr2-gold-75k.webp' },
      { id: 'gold_100k', name: '100,000 Gold', price: 16.99, description: '100,000 gold coins - Maximum package', image: 'csr2-gold-100k.webp' },
      { id: 'bronze_keys_1k', name: '1,000 Bronze Keys', price: 0.99, description: '1,000 bronze crate keys - Trial pack', image: 'csr2-bronze-keys-1k.webp' },
      { id: 'bronze_keys_2k5', name: '2,500 Bronze Keys', price: 1.99, description: '2,500 bronze crate keys - Small collection', image: 'csr2-bronze-keys-2k5.webp' },
      { id: 'bronze_keys_5k', name: '5,000 Bronze Keys', price: 2.99, description: '5,000 bronze crate keys - Standard pack', image: 'csr2-bronze-keys-5k.webp' },
      { id: 'bronze_keys_10k', name: '10,000 Bronze Keys', price: 5.50, description: '10,000 bronze crate keys - Maximum bronze', image: 'csr2-bronze-keys-10k.webp' },
      { id: 'silver_keys_500', name: '500 Silver Keys', price: 1.99, description: '500 silver crate keys - Starter pack', image: 'csr2-silver-keys-500.webp' },
      { id: 'silver_keys_1k', name: '1,000 Silver Keys', price: 2.99, description: '1,000 silver crate keys - Small collection', image: 'csr2-silver-keys-1k.webp' },
      { id: 'silver_keys_2k5', name: '2,500 Silver Keys', price: 3.75, description: '2,500 silver crate keys - Value pack', image: 'csr2-silver-keys-2k5.webp' },
      { id: 'silver_keys_5k', name: '5,000 Silver Keys', price: 6.99, description: '5,000 silver crate keys - Premium pack', image: 'csr2-silver-keys-5k.webp' },
      { id: 'silver_keys_10k', name: '10,000 Silver Keys', price: 12.99, description: '10,000 silver crate keys - Maximum silver', image: 'csr2-silver-keys-10k.webp' },
      { id: 'gold_keys_100', name: '100 Gold Keys', price: 4.99, description: '100 gold crate keys - Entry elite', image: 'csr2-gold-keys-100.webp' },
      { id: 'gold_keys_250', name: '250 Gold Keys', price: 9.99, description: '250 gold crate keys - Small elite collection', image: 'csr2-gold-keys-250.webp' },
      { id: 'gold_keys_500', name: '500 Gold Keys', price: 14.99, description: '500 gold crate keys - Premium elite', image: 'csr2-gold-keys-500.webp' },
      { id: 'gold_keys_1k', name: '1,000 Gold Keys', price: 24.99, description: '1,000 gold crate keys - Maximum gold', image: 'csr2-gold-keys-1k.webp' }
    ]
  },
  csr2_topup_packs: {
    name: '📦 CSR2 TOP UPS PACKS',
    emoji: '📦',
    items: [
      { id: 'trial_pack', name: 'Trial Pack - 100% Chargeback', price: 14.99, description: 'Trial package with money-back guarantee', image: 'csr2-pack-trial.webp' },
      { id: 'premium_pack', name: 'Premium Pack', price: 29.99, description: 'Premium resources bundle', image: 'csr2-pack-premium.webp' },
      { id: 'ultimate_pack', name: 'Ultimate Pack', price: 49.99, description: 'Ultimate resources package', image: 'csr2-pack-ultimate.webp' },
      { id: 'mega_pack', name: 'Mega Pack', price: 79.99, description: 'Mega bundle with maximum value', image: 'csr2-pack-mega.webp' },
      { id: 'legendary_pack', name: 'Legendary Pack', price: 99.99, description: 'Legendary tier with exclusive items', image: 'csr2-pack-legendary.webp' }
    ]
  },
  csr2_vip_packs: {
    name: '👑 CSR2 MODS VIP PACKS',
    emoji: '👑',
    items: [
      { id: 'shax_vip', name: 'CSR2 SHAX VIP', price: 24.99, description: 'SHAX boss tier VIP access', image: 'csr2-vip-shax.webp' },
      { id: 'donna_vip', name: 'CSR2 DONNA VIP', price: 39.99, description: 'DONNA boss tier VIP benefits', image: 'csr2-vip-donna.webp' },
      { id: 'tempest_vip', name: 'CSR2 Tempest VIP', price: 59.99, description: 'Tempest boss tier VIP package', image: 'csr2-vip-tempest.webp' },
      { id: 'boss_vip', name: 'CSR2 BOSS VIP', price: 89.99, description: 'Ultimate boss tier VIP status', image: 'csr2-vip-boss.webp' },
      { id: 'cheats_vip', name: 'CSR2 Cheats VIP', price: 149.99, description: 'Premium cheats and modifications VIP', image: 'csr2-vip-cheats.webp' }
    ]
  },
  csr2_services: {
    name: '🔧 CSR2 MODS SERVICES',
    emoji: '🔧',
    items: [
      { id: 'account_boost', name: 'Account Boost Service', price: 19.99, description: 'Professional account boosting', image: 'csr2-service-boost.webp' },
      { id: 'car_tuning', name: 'Car Tuning Service', price: 7.99, description: 'Expert car tuning and setup per car', image: 'csr2-service-tuning.webp' },
      { id: 'fusion_install', name: 'Fusion Parts Installation', price: 9.99, description: 'Install fusion parts on your cars (per car)', image: 'csr2-service-fusion.webp' },
      { id: 'stage6_upgrade', name: 'Stage 6 Upgrade Service', price: 14.99, description: 'Add Stage 6 upgrades to cars (per car)', image: 'csr2-service-stage6.webp' },
      { id: 'crew_boost', name: 'Crew RP Boost', price: 24.99, description: 'Boost your crew reputation points', image: 'csr2-service-crew.webp' },
      { id: 'trophy_recovery', name: 'Trophy Recovery', price: 12.99, description: 'Recover lost trophies', image: 'csr2-service-trophy.webp' }
    ]
  },
  csr2_accounts: {
    name: '👤 CSR2 ACCOUNTS',
    emoji: '👤',
    items: [
      { id: 'starter_account', name: 'Starter Account', price: 29.99, description: 'Fresh account with basic cars', image: 'csr2-account-starter.webp' },
      { id: 'intermediate_account', name: 'Intermediate Account', price: 59.99, description: 'Mid-level account with good cars', image: 'csr2-account-intermediate.webp' },
      { id: 'advanced_account', name: 'Advanced Account', price: 99.99, description: 'High-level account with rare cars', image: 'csr2-account-advanced.webp' },
      { id: 'pro_account', name: 'Pro Account', price: 149.99, description: 'Professional account with elite cars', image: 'csr2-account-pro.webp' },
      { id: 'legendary_account', name: 'Legendary Account', price: 299.99, description: 'Ultimate account with all cars', image: 'csr2-account-legendary.webp' },
      { id: 'custom_account', name: 'Custom Account Build', price: 199.99, description: 'Custom account built to your specs', image: 'csr2-account-custom.webp' }
    ]
  }
}

// Helper functions
function getUserSession (userId) {
  if (!userSessions.has(userId)) {
    userSessions.set(userId, {
      cart: [],
      currentCategory: null,
      orderHistory: [],
      searchResults: []
    })
  }
  return userSessions.get(userId)
}

function getMainMenuKeyboard () {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🏆 LUXURY CARS', callback_data: 'category_csr2_cars_luxury' },
          { text: '🏁 SPORTS CARS', callback_data: 'category_csr2_cars_sports' }
        ],
        [
          { text: '🇺🇸 AMERICAN CARS', callback_data: 'category_csr2_cars_american' },
          { text: '🇯🇵 JAPANESE CARS', callback_data: 'category_csr2_cars_japanese' }
        ],
        [
          { text: '🏎️ ALL CARS', callback_data: 'category_csr2_cars_all' },
          { text: '🔍 SEARCH CARS', callback_data: 'search_cars' }
        ],
        [
          { text: '💰 TOP UPS', callback_data: 'category_csr2_topups' },
          { text: '📦 PACKS', callback_data: 'category_csr2_topup_packs' }
        ],
        [
          { text: '👑 VIP PACKS', callback_data: 'category_csr2_vip_packs' },
          { text: '🔧 SERVICES', callback_data: 'category_csr2_services' }
        ],
        [
          { text: '👤 ACCOUNTS', callback_data: 'category_csr2_accounts' },
          { text: '🛒 View Cart', callback_data: 'view_cart' }
        ],
        [
          { text: '🌐 WebApp Store', web_app: { url: `${process.env.WEBAPP_URL || 'https://yourdomain.com'}/webapp` } },
          { text: '💬 Support', callback_data: 'support' }
        ]
      ]
    }
  }
}

function getCategoryKeyboard (categoryKey, page = 0) {
  const category = menuCategories[categoryKey]
  const keyboard = []
  const itemsPerPage = 10

  if (category.getCars) {
    // Handle car categories
    const cars = category.getCars()
    const startIndex = page * itemsPerPage
    const endIndex = Math.min(startIndex + itemsPerPage, cars.length)
    const pageCars = cars.slice(startIndex, endIndex)

    pageCars.forEach(car => {
      keyboard.push([{
        text: `${car.name} - ${car.price}`,
        callback_data: `car_${car.id}`
      }])
    })

    // Pagination controls
    const paginationRow = []
    if (page > 0) {
      paginationRow.push({ text: '⬅️ Previous', callback_data: `page_${categoryKey}_${page - 1}` })
    }
    if (endIndex < cars.length) {
      paginationRow.push({ text: 'Next ➡️', callback_data: `page_${categoryKey}_${page + 1}` })
    }
    if (paginationRow.length > 0) {
      keyboard.push(paginationRow)
    }

    keyboard.push([
      { text: `📊 Showing ${startIndex + 1}-${endIndex} of ${cars.length}`, callback_data: 'noop' }
    ])
  } else if (category.items) {
    // Handle other categories with static items
    category.items.forEach(item => {
      const priceText = typeof item.price === 'number' ? `${item.price}` : item.price
      keyboard.push([{
        text: `${item.name} - ${priceText}`,
        callback_data: `item_${item.id}`
      }])
    })
  }

  keyboard.push([
    { text: '⬅️ Back to Menu', callback_data: 'main_menu' },
    { text: '🛒 View Cart', callback_data: 'view_cart' }
  ])

  return { reply_markup: { inline_keyboard: keyboard } }
}

function getCarKeyboard (carId) {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🛒 Add to Cart', callback_data: `add_car_${carId}` }
        ],
        [
          { text: '⬅️ Back', callback_data: 'back_to_category' },
          { text: '🛒 View Cart', callback_data: 'view_cart' }
        ]
      ]
    }
  }
}

function getItemKeyboard (itemId) {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🛒 Add to Cart', callback_data: `add_${itemId}` }
        ],
        [
          { text: '⬅️ Back', callback_data: 'back_to_category' },
          { text: '🛒 View Cart', callback_data: 'view_cart' }
        ]
      ]
    }
  }
}

function getCartKeyboard () {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🗑️ Clear Cart', callback_data: 'clear_cart' },
          { text: '✅ Checkout', callback_data: 'checkout' }
        ],
        [
          { text: '⬅️ Back to Menu', callback_data: 'main_menu' },
          { text: '💬 Support', callback_data: 'support' }
        ]
      ]
    }
  }
}

function findItemById (itemId) {
  // Check if it's a car
  if (carsDatabase.has(itemId)) {
    return { item: carsDatabase.get(itemId), category: 'cars', type: 'car' }
  }

  // Check other categories
  for (const categoryKey in menuCategories) {
    const category = menuCategories[categoryKey]
    if (category.items) {
      const item = category.items.find(item => item.id === itemId)
      if (item) return { item, category: categoryKey, type: 'item' }
    }
  }
  return null
}

function searchCars (query) {
  const searchTerm = query.toLowerCase()
  const results = []

  for (const car of carsDatabase.values()) {
    if (car.name.toLowerCase().includes(searchTerm) ||
        car.brand.toLowerCase().includes(searchTerm) ||
        car.tags.toLowerCase().includes(searchTerm)) {
      results.push(car)
    }
  }

  return results.slice(0, 20) // Limit to 20 results
}

function formatCart (cart) {
  if (cart.length === 0) {
    return '🛒 Your cart is empty\n\n🏎️ Start shopping for CSR2 cars, mods, and services!\n\nVisit our categories to find what you need.'
  }

  let message = '🛒 Your CSR2 MODS Cart:\n\n'
  let total = 0
  let hasContactItems = false

  cart.forEach((item, index) => {
    const priceText = typeof item.price === 'number' ? `${item.price.toFixed(2)}` : item.price
    message += `${index + 1}. ${item.name}\n`
    message += `   💰 ${priceText}\n\n`

    if (typeof item.price === 'number') {
      total += item.price
    } else {
      hasContactItems = true
    }
  })

  if (total > 0) {
    message += `💳 Subtotal: ${total.toFixed(2)}\n`
  }
  if (hasContactItems) {
    message += '📞 Some items require contact for pricing'
  }

  return message
}

// Bot commands
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id
  const carCount = carsDatabase.size
  const welcomeMessage = `
🏎️ Welcome to CSR2 MODS STORE!

Hello ${msg.from.first_name}! 👋

🌐 Official Store: csr2mod.com

We have ${carCount}+ premium CSR2 cars and services available:

🏆 Luxury supercars (Bugatti, McLaren, Ferrari)
🏁 High-performance sports cars
🇺🇸 Iconic American muscle cars  
🇯🇵 Japanese performance legends
💰 Gold & Cash packages
👑 VIP memberships & services

Select a category to start shopping:
  `

  bot.sendMessage(chatId, welcomeMessage, getMainMenuKeyboard())
})

bot.onText(/\/menu/, (msg) => {
  const chatId = msg.chat.id
  bot.sendMessage(chatId, '🏎️ CSR2 MODS STORE - Choose a category:', getMainMenuKeyboard())
})

bot.onText(/\/cart/, (msg) => {
  const chatId = msg.chat.id
  const session = getUserSession(msg.from.id)
  const cartMessage = formatCart(session.cart)

  bot.sendMessage(chatId, cartMessage, getCartKeyboard())
})

bot.onText(/\/search (.+)/, (msg, match) => {
  const chatId = msg.chat.id
  const searchQuery = match[1]
  const session = getUserSession(msg.from.id)

  const results = searchCars(searchQuery)

  if (results.length === 0) {
    bot.sendMessage(chatId, `🔍 No cars found for "${searchQuery}"\n\nTry searching for:\n• Brand names (Bugatti, McLaren, etc.)\n• Car models (Chiron, 720S, etc.)\n• General terms (supercar, sports, etc.)`)
    return
  }

  session.searchResults = results

  let message = `🔍 Found ${results.length} cars for "${searchQuery}":\n\n`
  results.slice(0, 10).forEach((car, index) => {
    message += `${index + 1}. ${car.name} - ${car.price}\n`
  })

  if (results.length > 10) {
    message += `\n... and ${results.length - 10} more cars`
  }

  const keyboard = {
    reply_markup: {
      inline_keyboard: results.slice(0, 5).map(car => ([{
        text: `${car.name} - ${car.price}`,
        callback_data: `car_${car.id}`
      }])).concat([[
        { text: '🔍 Search Again', callback_data: 'search_cars' },
        { text: '⬅️ Back to Menu', callback_data: 'main_menu' }
      ]])
    }
  }

  bot.sendMessage(chatId, message, keyboard)
})

bot.onText(/\/brands/, (msg) => {
  const chatId = msg.chat.id
  const brands = Array.from(carsByBrand.keys()).sort()
  const topBrands = brands.slice(0, 20)

  let message = '🏭 Available Car Brands:\n\n'
  topBrands.forEach((brand, index) => {
    const count = carsByBrand.get(brand).length
    message += `${index + 1}. ${brand} (${count} cars)\n`
  })

  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🔍 Search by Brand', callback_data: 'search_cars' },
          { text: '⬅️ Back to Menu', callback_data: 'main_menu' }
        ]
      ]
    }
  }

  bot.sendMessage(chatId, message, keyboard)
})

bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id
  const helpMessage = `
🤖 CSR2 MODS STORE Bot Help

🌐 Website: csr2mod.com

Available commands:
/start - Main menu with ${carsDatabase.size}+ cars
/menu - Browse all categories
/cart - View your shopping cart  
/search [term] - Search for specific cars
/brands - View all available car brands
/help - Show this help message

📱 How to order:
1️⃣ Choose a category or search for cars
2️⃣ Select items you want to purchase
3️⃣ Review your cart
4️⃣ Proceed to checkout

🔐 We offer:
✅ ${carsDatabase.size}+ premium CSR2 cars
✅ Instant delivery for digital items
✅ Professional customer support
✅ Money-back guarantee

Need help? Use the Support button in the menu!
  `

  bot.sendMessage(chatId, helpMessage)
})

// Handle callback queries
bot.on('callback_query', (query) => {
  const chatId = query.message.chat.id
  const messageId = query.message.message_id
  const data = query.data
  const userId = query.from.id
  const session = getUserSession(userId)

  // Handle pagination
  if (data.startsWith('page_')) {
    const [, categoryKey, pageStr] = data.split('_')
    const page = parseInt(pageStr)
    const category = menuCategories[categoryKey]

    bot.editMessageText(
      `${category.emoji} ${category.name}\n\nChoose a car:`,
      {
        chat_id: chatId,
        message_id: messageId,
        ...getCategoryKeyboard(categoryKey, page)
      }
    )
  } else if (data.startsWith('category_')) { // Handle category selection
    const categoryKey = data.replace('category_', '')
    session.currentCategory = categoryKey
    const category = menuCategories[categoryKey]

    bot.editMessageText(
      `${category.emoji} ${category.name}\n\nChoose an item:`,
      {
        chat_id: chatId,
        message_id: messageId,
        ...getCategoryKeyboard(categoryKey)
      }
    )
  } else if (data.startsWith('car_')) { // Handle car selection
    const carId = data.replace('car_', '')
    const car = carsDatabase.get(carId)

    if (car) {
      const carMessage = `
🏎️ ${car.name}

🏭 Brand: ${car.brand}
📝 ${car.description}

💰 Price: ${car.price.toFixed(2)}

🚚 Digital delivery - Instant
🔒 Safe & secure transaction

${car.variants && car.variants.length > 0 ? `\n🎨 Available colors: ${car.variants.map(v => v.color).join(', ')}` : ''}

Would you like to add this car to your cart?
      `

      bot.editMessageText(carMessage, {
        chat_id: chatId,
        message_id: messageId,
        ...getCarKeyboard(carId)
      })
    }
  } else if (data.startsWith('add_car_')) { // Handle add car to cart
    const carId = data.replace('add_car_', '')
    const car = carsDatabase.get(carId)

    if (car) {
      session.cart.push(car)

      bot.answerCallbackQuery(query.id, {
        text: `✅ ${car.name} added to cart!`,
        show_alert: true
      })

      // Show updated cart
      const cartMessage = formatCart(session.cart)
      bot.editMessageText(cartMessage, {
        chat_id: chatId,
        message_id: messageId,
        ...getCartKeyboard()
      })
    }
  } else if (data === 'search_cars') { // Handle search cars
    bot.editMessageText(
      '🔍 Search for CSR2 Cars\n\nSend me a search term like:\n• Brand name (Bugatti, McLaren)\n• Car model (Chiron, 720S)\n• Type (supercar, sports car)\n\nExample: /search Bugatti',
      {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {
          inline_keyboard: [
            [{ text: '⬅️ Back to Menu', callback_data: 'main_menu' }]
          ]
        }
      }
    )
  } else if (data.startsWith('item_')) { // Handle item selection (non-car items)
    const itemId = data.replace('item_', '')
    const result = findItemById(itemId)

    if (result) {
      const { item } = result
      const priceText = typeof item.price === 'number' ? `${item.price.toFixed(2)}` : 'Contact for pricing'
      const itemMessage = `
🎮 ${item.name}

📝 ${item.description}

💰 Price: ${priceText}

🚚 Digital delivery (instant for most items)
🔒 Safe & secure transaction

${typeof item.price === 'string' ? '📞 Contact support for custom pricing' : 'Would you like to add this to your cart?'}
      `

      bot.editMessageText(itemMessage, {
        chat_id: chatId,
        message_id: messageId,
        ...getItemKeyboard(itemId)
      })
    }
  } else if (data.startsWith('add_') && !data.startsWith('add_car_')) { // Handle add item to cart (non-car items)
    const itemId = data.replace('add_', '')
    const result = findItemById(itemId)

    if (result) {
      const { item } = result
      session.cart.push(item)

      bot.answerCallbackQuery(query.id, {
        text: `✅ ${item.name} added to cart!`,
        show_alert: true
      })

      // Show updated cart
      const cartMessage = formatCart(session.cart)
      bot.editMessageText(cartMessage, {
        chat_id: chatId,
        message_id: messageId,
        ...getCartKeyboard()
      })
    }
  } else if (data === 'main_menu') { // Handle main menu
    bot.editMessageText('🏎️ CSR2 MODS STORE - Choose a category:', {
      chat_id: chatId,
      message_id: messageId,
      ...getMainMenuKeyboard()
    })
  } else if (data === 'back_to_category') { // Handle back to category
    if (session.currentCategory) {
      const category = menuCategories[session.currentCategory]
      bot.editMessageText(`${category.emoji} ${category.name}\n\nChoose an item:`, {
        chat_id: chatId,
        message_id: messageId,
        ...getCategoryKeyboard(session.currentCategory)
      })
    } else {
      bot.editMessageText('🏎️ CSR2 MODS STORE - Choose a category:', {
        chat_id: chatId,
        message_id: messageId,
        ...getMainMenuKeyboard()
      })
    }
  } else if (data === 'view_cart') { // Handle view cart
    const cartMessage = formatCart(session.cart)
    bot.editMessageText(cartMessage, {
      chat_id: chatId,
      message_id: messageId,
      ...getCartKeyboard()
    })
  } else if (data === 'clear_cart') { // Handle clear cart
    session.cart = []
    bot.answerCallbackQuery(query.id, {
      text: '🗑️ Cart cleared!',
      show_alert: true
    })

    const cartMessage = formatCart(session.cart)
    bot.editMessageText(cartMessage, {
      chat_id: chatId,
      message_id: messageId,
      ...getCartKeyboard()
    })
  } else if (data === 'checkout') { // Handle checkout
    if (session.cart.length === 0) {
      bot.answerCallbackQuery(query.id, {
        text: '🛒 Your cart is empty!',
        show_alert: true
      })
      return
    }

    // Calculate total
    const fixedPriceItems = session.cart.filter(item => typeof item.price === 'number')
    const contactItems = session.cart.filter(item => typeof item.price === 'string')
    const total = fixedPriceItems.reduce((sum, item) => sum + item.price, 0)

    // Create order summary
    let orderSummary = '🎮 CSR2 MODS ORDER\n\n'
    orderSummary += `👤 Customer: ${query.from.first_name} ${query.from.last_name || ''}\n`
    orderSummary += `📱 Username: @${query.from.username || 'N/A'}\n`
    orderSummary += `🆔 User ID: ${query.from.id}\n\n`
    orderSummary += '🛒 Items Ordered:\n'

    session.cart.forEach((item, index) => {
      const priceText = typeof item.price === 'number' ? `${item.price.toFixed(2)}` : item.price
      orderSummary += `${index + 1}. ${item.name} - ${priceText}\n`
    })

    if (total > 0) {
      orderSummary += `\n💳 Fixed Price Total: ${total.toFixed(2)}\n`
    }
    if (contactItems.length > 0) {
      orderSummary += `📞 Contact items: ${contactItems.length}\n`
    }
    orderSummary += `📅 Date: ${new Date().toLocaleString()}\n`
    orderSummary += '🌐 Store: csr2mod.com'

    // Send order to admin
    if (adminChatId) {
      bot.sendMessage(adminChatId, `🔔 NEW CSR2 ORDER!\n\n${orderSummary}`)
    }

    // Send confirmation to user
    const confirmationMessage = `
✅ Order Confirmed!

Thank you for choosing CSR2 MODS STORE! 

${orderSummary}

📞 Next Steps:
• Our team will process your order
• Digital items: Instant delivery
• Account services: 1-24 hours
• We'll contact you via Telegram

🔒 Payment Instructions:
Our support team will send you secure payment details shortly.

Order ID: #CSR${Date.now()}
🌐 csr2mod.com
    `

    bot.editMessageText(confirmationMessage, {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🏎️ Shop Again', callback_data: 'main_menu' },
            { text: '💬 Support', callback_data: 'support' }
          ]
        ]
      }
    })

    // Clear cart and save to order history
    session.orderHistory.push({
      items: [...session.cart],
      total,
      contactItems: contactItems.length,
      date: new Date().toISOString(),
      orderId: `CSR${Date.now()}`
    })
    session.cart = []
  } else if (data === 'support') { // Handle support
    const supportMessage = `
💬 CSR2 MODS STORE Support

🌐 Website: csr2mod.com
📧 Email: support@csr2mod.com
💬 Telegram: @csr2mods

⏰ Support Hours:
📅 Monday - Friday: 9:00 AM - 11:00 PM (EST)
📅 Saturday - Sunday: 10:00 AM - 8:00 PM (EST)

🔥 Quick Help:
• Order status and delivery
• Payment assistance  
• Technical support
• Account issues
• Custom requests

📱 For urgent issues, contact us directly on Telegram.

🔒 We guarantee:
✅ Safe transactions
✅ Quick delivery
✅ Professional support
✅ Money-back guarantee
    `

    bot.editMessageText(supportMessage, {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🌐 Visit Website', url: 'https://csr2mod.com' },
            { text: '💬 Contact Support', url: 'https://t.me/csr2mods' }
          ],
          [
            { text: '⬅️ Back to Menu', callback_data: 'main_menu' }
          ]
        ]
      }
    })
  } else if (data === 'noop') { // Handle noop (no operation)
    bot.answerCallbackQuery(query.id)
    return
  }

  // Answer callback query to remove loading state
  bot.answerCallbackQuery(query.id)
})

// Handle text messages
bot.on('message', (msg) => {
  if (msg.text && !msg.text.startsWith('/')) {
    const chatId = msg.chat.id
    bot.sendMessage(chatId,
      `🏎️ Welcome to CSR2 MODS STORE!\n\n🌐 csr2mod.com\n\nWe have ${carsDatabase.size}+ premium CSR2 cars available!\n\nUse /menu to browse categories or /search [term] to find specific cars! 🏁`,
      getMainMenuKeyboard()
    )
  }
})

// Error handling
bot.on('polling_error', (error) => {
  console.log('Polling error:', error)
})

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    bot: 'CSR2 MODS STORE',
    cars_loaded: carsDatabase.size,
    brands: carsByBrand.size
  })
})

// Initialize and start
async function startBot () {
  console.log('🏎️ Starting CSR2 MODS STORE Bot...')

  // Load cars database
  await loadCarsDatabase()

  // Start express server
  app.listen(port, () => {
    console.log(`🏎️ CSR2 MODS STORE Bot V1.0.0 Final is running on port ${port}`)
    console.log('📡 Polling for messages...')
    console.log(`🌐 WebApp available at: http://localhost:${port}/webapp`)
    console.log(`🚗 Cars loaded: ${carsDatabase.size}`)
    console.log(`🏭 Brands available: ${carsByBrand.size}`)
  })

  console.log('🎮 CSR2 MODS STORE Bot V1.0.0 Final started successfully!')
}

// Start the bot
startBot().catch(console.error)
