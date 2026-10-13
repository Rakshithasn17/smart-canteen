import express from 'express'

import cors from 'cors'

import db from './database'

import dotenv from 'dotenv'

import { createHmac, timingSafeEqual } from 'node:crypto'

dotenv.config()

const app = express()

const PORT = Number(process.env.PORT) || 3001

app.use(cors())

app.use(express.json())

// Add pickup_time to existing databases without deleting any orders.
const orderColumns = db.prepare('PRAGMA table_info(orders)').all() as { name: string }[]
if (!orderColumns.some((column) => column.name === 'pickup_time')) {
  db.exec("ALTER TABLE orders ADD COLUMN pickup_time TEXT NOT NULL DEFAULT '08:00'")
}
if (!orderColumns.some((column) => column.name === 'payment_method')) {
  db.exec("ALTER TABLE orders ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'Cash'")
}
if (!orderColumns.some((column) => column.name === 'payment_status')) {
  db.exec("ALTER TABLE orders ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'Unpaid'")
}

function isValidPickupTime(value: unknown): value is string {
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return false
  const [hours, minutes] = value.split(':').map(Number)
  const totalMinutes = hours * 60 + minutes
  const start = 8 * 60
  const end = 16 * 60 + 30
  return totalMinutes >= start && totalMinutes <= end && (totalMinutes - start) % 15 === 0
}

const staffUsername = process.env.STAFF_USERNAME

const staffPassword = process.env.STAFF_PASSWORD

const sessionSecret = process.env.SESSION_SECRET

if (!staffUsername || !staffPassword || !sessionSecret) {

  throw new Error('Missing STAFF_USERNAME, STAFF_PASSWORD, or SESSION_SECRET in server/.env')

}

function sign(value: string) {

  return createHmac('sha256', sessionSecret)

    .update(value)

    .digest('base64url')

}

function createSession(username: string) {

  const payload = Buffer.from(JSON.stringify({

    username,

    expiresAt: Date.now() + 8 * 60 * 60 * 1000,

  })).toString('base64url')

  return `${payload}.${sign(payload)}`

}

function isValidSession(token: string) {

  try {

    const [payload, signature] = token.split('.')

    if (!payload || !signature) return false

    const expected = sign(payload)

    const suppliedBuffer = Buffer.from(signature)

    const expectedBuffer = Buffer.from(expected)

    if (

      suppliedBuffer.length !== expectedBuffer.length ||

      !timingSafeEqual(suppliedBuffer, expectedBuffer)

    ) return false

    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))

    return session.username === staffUsername &&

      typeof session.expiresAt === 'number' && session.expiresAt > Date.now()

  } catch {

    return false

  }

}

function requireStaff(

  req: express.Request,

  res: express.Response,

  next: express.NextFunction,

) {

  const authorization = req.headers.authorization

  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : ''

  if (!token || !isValidSession(token)) {

    return res.status(401).json({ error: 'Staff login required. Please sign in again.' })

  }

  next()

}

app.get('/api/health', (_req, res) => {

  res.json({ status: 'ok', message: 'Smart Canteen backend is running!' })

})

app.post('/api/staff/login', (req, res) => {

  const { username, password } = req.body ?? {}

  if (typeof username !== 'string' || typeof password !== 'string') {

    return res.status(400).json({ error: 'Enter your username and password.' })

  }

  const usernameBuffer = Buffer.from(username)

  const expectedUsernameBuffer = Buffer.from(staffUsername)

  const passwordBuffer = Buffer.from(password)

  const expectedPasswordBuffer = Buffer.from(staffPassword)

  const usernameMatches = usernameBuffer.length === expectedUsernameBuffer.length &&

    timingSafeEqual(usernameBuffer, expectedUsernameBuffer)

  const passwordMatches = passwordBuffer.length === expectedPasswordBuffer.length &&

    timingSafeEqual(passwordBuffer, expectedPasswordBuffer)

  if (!usernameMatches || !passwordMatches) {

    return res.status(401).json({ error: 'Incorrect username or password.' })

  }

  res.json({ token: createSession(staffUsername), username: staffUsername })

})

// Student menu: only items currently available for purchase.

app.get('/api/menu', (_req, res) => {

  const items = db.prepare(

    'SELECT * FROM menu_items WHERE available = 1 ORDER BY id',

  ).all()

  res.json(items)

})

// Staff menu: includes unavailable items so staff can manage them.

app.get('/api/staff/menu', requireStaff, (_req, res) => {

  const items = db.prepare('SELECT * FROM menu_items ORDER BY id DESC').all()

  res.json(items)

})

// Staff: add a menu item.

app.post('/api/staff/menu', requireStaff, (req, res) => {

  const { name, category, price, description, prep_time, image } = req.body ?? {}

  if (

    typeof name !== 'string' || !name.trim() || name.trim().length > 100 ||

    typeof category !== 'string' || !category.trim() || category.trim().length > 50 ||

    !Number.isInteger(price) || price < 0 || price > 100000 ||

    typeof description !== 'string' || !description.trim() || description.trim().length > 500 ||

    !Number.isInteger(prep_time) || prep_time < 0 || prep_time > 240 ||

    (image !== undefined && typeof image !== 'string')

  ) {

    return res.status(400).json({ error: 'Enter a valid name, category, price, description and preparation time.' })

  }

  const result = db.prepare(`

    INSERT INTO menu_items (name, category, price, description, prep_time, image, available)

    VALUES (?, ?, ?, ?, ?, ?, 1)

  `).run(

    name.trim(), category.trim(), price, description.trim(), prep_time,

    typeof image === 'string' ? image.trim() : '',

  )

  const item = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(Number(result.lastInsertRowid))

  res.status(201).json(item)

})

// Staff: edit a menu item or mark it available/unavailable.

app.patch('/api/staff/menu/:id', requireStaff, (req, res) => {

  const id = Number(req.params.id)

  const { name, category, price, description, prep_time, image, available } = req.body ?? {}

  if (!Number.isInteger(id) || id < 1) {

    return res.status(400).json({ error: 'Invalid menu item ID.' })

  }

  const existing = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(id) as

    | { id: number; name: string; category: string; price: number; description: string; prep_time: number; image: string; available: number }

    | undefined

  if (!existing) return res.status(404).json({ error: 'Menu item not found.' })

  const nextName = name === undefined ? existing.name : name

  const nextCategory = category === undefined ? existing.category : category

  const nextPrice = price === undefined ? existing.price : price

  const nextDescription = description === undefined ? existing.description : description

  const nextPrepTime = prep_time === undefined ? existing.prep_time : prep_time

  const nextImage = image === undefined ? existing.image : image

  const nextAvailable = available === undefined ? existing.available : available

  if (

    typeof nextName !== 'string' || !nextName.trim() || nextName.trim().length > 100 ||

    typeof nextCategory !== 'string' || !nextCategory.trim() || nextCategory.trim().length > 50 ||

    !Number.isInteger(nextPrice) || nextPrice < 0 || nextPrice > 100000 ||

    typeof nextDescription !== 'string' || !nextDescription.trim() || nextDescription.trim().length > 500 ||

    !Number.isInteger(nextPrepTime) || nextPrepTime < 0 || nextPrepTime > 240 ||

    typeof nextImage !== 'string' ||

    ![0, 1].includes(nextAvailable)

  ) {

    return res.status(400).json({ error: 'Invalid menu item details.' })

  }

  db.prepare(`

    UPDATE menu_items

    SET name = ?, category = ?, price = ?, description = ?, prep_time = ?, image = ?, available = ?

    WHERE id = ?

  `).run(

    nextName.trim(), nextCategory.trim(), nextPrice, nextDescription.trim(),

    nextPrepTime, nextImage.trim(), nextAvailable, id,

  )

  res.json(db.prepare('SELECT * FROM menu_items WHERE id = ?').get(id))

})

// Staff-only: retrieve orders and their items.

app.get('/api/orders', requireStaff, (_req, res) => {

  const orders = db.prepare(`

    SELECT id, token, student_name AS studentName,

           total, status, pickup_time AS pickupTime, payment_method AS paymentMethod, payment_status AS paymentStatus, created_at AS createdAt

    FROM orders

    ORDER BY id DESC

  `).all() as {

    id: number

    token: number

    studentName: string

    total: number

    status: string

    pickupTime: string

    paymentMethod: string

    paymentStatus: string

    createdAt: string

  }[]

  const getItems = db.prepare(`

    SELECT menu_items.name, order_items.quantity, order_items.price

    FROM order_items

    JOIN menu_items ON menu_items.id = order_items.menu_item_id

    WHERE order_items.order_id = ?

  `)

  res.json(orders.map(order => ({ ...order, items: getItems.all(order.id) })))

})

// Staff-only: update an order status.

app.patch('/api/orders/:id/payment', requireStaff, (req, res) => {
  const id = Number(req.params.id)
  const { paymentStatus } = req.body ?? {}
  if (!Number.isInteger(id) || id < 1 || !['Paid', 'Unpaid'].includes(paymentStatus)) {
    return res.status(400).json({ error: 'Invalid order ID or payment status.' })
  }
  const result = db.prepare('UPDATE orders SET payment_status = ? WHERE id = ?').run(paymentStatus, id)
  if (result.changes === 0) return res.status(404).json({ error: 'Order not found.' })
  return res.json({ success: true, id, paymentStatus })
})

app.patch('/api/orders/:id/status', requireStaff, (req, res) => {

  const id = Number(req.params.id)

  const { status } = req.body ?? {}

  const allowed = ['Pending', 'Preparing', 'Ready', 'Completed', 'Cancelled']

  if (!Number.isInteger(id) || id < 1 || !allowed.includes(status)) {

    return res.status(400).json({ error: 'Invalid order ID or status.' })

  }

  const result = db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, id)

  if (result.changes === 0) return res.status(404).json({ error: 'Order not found.' })

  res.json({ success: true, id, status })

})

// Student checkout remains public.

app.post('/api/orders', (req, res) => {

  const { studentName, items, pickupTime, paymentMethod, demoPaymentSuccessful } = req.body ?? {}

  if (

    typeof studentName !== 'string' || !studentName.trim() ||

    !isValidPickupTime(pickupTime) ||

    !['Cash', 'UPI'].includes(paymentMethod) ||

    !Array.isArray(items) || items.length === 0

  ) {

    return res.status(400).json({ error: 'Enter your name, choose a valid pickup time and payment method, and add at least one item.' })

  }

  const findItem = db.prepare(

    'SELECT id, name, price FROM menu_items WHERE id = ? AND available = 1',

  )

  const initialPaymentStatus = paymentMethod === 'UPI' && demoPaymentSuccessful === true ? 'Paid' : 'Unpaid'
  const createOrder = db.prepare('INSERT INTO orders (token, student_name, total, pickup_time, payment_method, payment_status) VALUES (?, ?, ?, ?, ?, ?)')

  const addOrderItem = db.prepare(`

    INSERT INTO order_items (order_id, menu_item_id, quantity, price)

    VALUES (?, ?, ?, ?)

  `)

  const createOrderTransaction = db.transaction(() => {

    let total = 0

    const orderItems: { id: number; name: string; price: number; quantity: number }[] = []

    for (const item of items) {

      if (

        !Number.isInteger(item.id) || !Number.isInteger(item.quantity) ||

        item.quantity < 1 || item.quantity > 20

      ) throw new Error('Each item needs a valid ID and quantity (1–20).')

      const menuItem = findItem.get(item.id) as

        | { id: number; name: string; price: number }

        | undefined

      if (!menuItem) throw new Error('A selected menu item is unavailable.')

      total += menuItem.price * item.quantity

      orderItems.push({ id: menuItem.id, name: menuItem.name, price: menuItem.price, quantity: item.quantity })

    }

    const lastOrder = db.prepare('SELECT MAX(token) AS lastToken FROM orders').get() as { lastToken: number | null }

    const token = Math.max(100, lastOrder.lastToken ?? 100) + 1

    const result = createOrder.run(token, studentName.trim(), total, pickupTime, paymentMethod, initialPaymentStatus)

    const orderId = Number(result.lastInsertRowid)

    for (const item of orderItems) addOrderItem.run(orderId, item.id, item.quantity, item.price)

    return { orderId, token, studentName: studentName.trim(), total, pickupTime, paymentMethod, paymentStatus: initialPaymentStatus, items: orderItems }

  })

  try {

    return res.status(201).json(createOrderTransaction())

  } catch (error) {

    const message = error instanceof Error ? error.message : 'Unable to place order.'

    return res.status(400).json({ error: message })

  }

})

// Public student tracking: returns only the order matching this pickup token.

app.get('/api/track/:token', (req, res) => {

  const token = Number(req.params.token)

  if (!Number.isInteger(token) || token < 1) {

    return res.status(400).json({ error: 'Enter a valid pickup token.' })

  }

  const order = db.prepare(`

    SELECT token, total, status, pickup_time AS pickupTime, payment_method AS paymentMethod, payment_status AS paymentStatus, created_at AS createdAt

    FROM orders

    WHERE token = ?

  `).get(token) as

    | { token: number; total: number; status: string; pickupTime: string; paymentMethod: string; paymentStatus: string; createdAt: string }

    | undefined

  if (!order) {

    return res.status(404).json({ error: 'No order found for that pickup token.' })

  }

  const items = db.prepare(`

    SELECT menu_items.name, order_items.quantity, order_items.price

    FROM order_items

    JOIN menu_items ON menu_items.id = order_items.menu_item_id

    JOIN orders ON orders.id = order_items.order_id

    WHERE orders.token = ?

  `).all(token) as { name: string; quantity: number; price: number }[]

  return res.json({ ...order, items })

})

app.listen(PORT, () => {

  console.log(`Smart Canteen API running at http://localhost:${PORT}`)

})

