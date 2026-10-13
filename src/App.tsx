import { useEffect, useMemo, useState } from 'react'

import './App.css'

import StaffDashboard from './StaffDashboard'



type FoodItem = {

  id: number

  name: string

  category: string

  price: number

  description: string

  time: number

  image: string

  available: boolean

}



const categories = ['All Items', 'Meals', 'Quick Bites', 'Drinks']

const pickupTimeSlots = Array.from({ length: 35 }, (_, index) => {
  const totalMinutes = 8 * 60 + index * 15
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
})

function formatPickupTime(value: string) {
  const [hours, minutes] = value.split(':').map(Number)
  const suffix = hours >= 12 ? 'PM' : 'AM'
  const displayHour = hours % 12 || 12
  return `${displayHour}:${String(minutes).padStart(2, '0')} ${suffix}`
}



function StudentApp() {

  const [foods, setFoods] = useState<FoodItem[]>([])

  const [menuLoading, setMenuLoading] = useState(true)

  const [menuError, setMenuError] = useState('')



  useEffect(() => {

    let cancelled = false



    async function loadMenu() {

      try {

        const response = await fetch('http://localhost:3001/api/menu')



        if (!response.ok) {

          throw new Error('Could not load the menu.')

        }



        const data: Array<{

          id: number

          name: string

          category: string

          price: number

          description: string

          prep_time: number

          image: string

          available: number | boolean

        }> = await response.json()



        if (!cancelled) {

          setFoods(

            data.map((item) => ({

              id: item.id,

              name: item.name,

              category: item.category,

              price: item.price,

              description: item.description,

              time: item.prep_time,

              image: item.image,

              available: Boolean(item.available),

            })),

          )

          setMenuError('')

        }

      } catch {

        if (!cancelled) {

          setMenuError(

            'Unable to load the menu. Make sure the backend is running.',

          )

        }

      } finally {

        if (!cancelled) {

          setMenuLoading(false)

        }

      }

    }



    loadMenu()



    return () => {

      cancelled = true

    }

  }, [])



  const [category, setCategory] = useState('All Items')

  const [search, setSearch] = useState('')

  const [cart, setCart] = useState<Record<number, number>>({})

  const [cartOpen, setCartOpen] = useState(false)

  const [notice, setNotice] = useState('')

  const [studentName, setStudentName] = useState('')
  const [pickupTime, setPickupTime] = useState('08:00')
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'UPI'>('Cash')

  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [demoPaymentOpen, setDemoPaymentOpen] = useState(false)

  const [orderConfirmation, setOrderConfirmation] = useState<{

    orderId: number

    token: number

    studentName: string

    total: number

    pickupTime: string

    paymentMethod: 'Cash' | 'UPI'

    paymentStatus: string

  } | null>(null)

  const [trackingToken, setTrackingToken] = useState('')
  const [trackingOrder, setTrackingOrder] = useState<{
    token: number
    total: number
    status: string
    paymentMethod: 'Cash' | 'UPI'
    paymentStatus: string
    pickupTime: string
    createdAt: string
    items: Array<{ name: string; quantity: number; price: number }>
  } | null>(null)
  const [trackingLoading, setTrackingLoading] = useState(false)
  const [trackingError, setTrackingError] = useState('')

  async function trackOrder(tokenValue = trackingToken) {
    const cleanToken = tokenValue.trim()
    if (!cleanToken || !/^\d+$/.test(cleanToken)) {
      setTrackingError('Enter the numeric pickup token shown after checkout.')
      setTrackingOrder(null)
      return
    }
    setTrackingLoading(true)
    setTrackingError('')
    try {
      const response = await fetch(`http://localhost:3001/api/track/${encodeURIComponent(cleanToken)}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Order not found. Check your pickup token.')
      setTrackingOrder(data)
      setTrackingToken(cleanToken)
    } catch (error) {
      setTrackingOrder(null)
      setTrackingError(error instanceof Error ? error.message : 'Unable to track this order.')
    } finally {
      setTrackingLoading(false)
    }
  }

  useEffect(() => {
    if (!trackingOrder) return
    const timer = window.setInterval(() => {
      void trackOrder(String(trackingOrder.token))
    }, 5000)
    return () => window.clearInterval(timer)
  }, [trackingOrder?.token])

  const visibleFoods = useMemo(

    () =>

      foods.filter(

        (food) =>

          food.available &&

          (category === 'All Items' || food.category === category) &&

          food.name.toLowerCase().includes(search.toLowerCase()),

      ),

    [foods, category, search],

  )



  const cartItems = foods.filter((food) => (cart[food.id] ?? 0) > 0)

  const totalItems = Object.values(cart).reduce((sum, qty) => sum + qty, 0)

  const totalPrice = cartItems.reduce(

    (sum, food) => sum + food.price * cart[food.id],

    0,

  )

  const pickupMinutes = cartItems.reduce(

    (max, food) => Math.max(max, food.time),

    0,

  )



  function changeQuantity(id: number, change: number) {

    setCart((previous) => {

      const nextQuantity = (previous[id] ?? 0) + change

      const next = { ...previous }



      if (nextQuantity <= 0) {

        delete next[id]

      } else {

        next[id] = nextQuantity

      }



      return next

    })

    setNotice('')

  }



  async function placeOrder(demoPaymentSuccessful = false) {

    if (!studentName.trim()) {

      setNotice('Please enter your name before placing your order.')

      return

    }



    if (totalItems === 0) {

      setNotice('Please add at least one item to your cart.')

      return

    }



    setCheckoutLoading(true)

    setNotice('')



    try {

      const response = await fetch('http://localhost:3001/api/orders', {

        method: 'POST',

        headers: {

          'Content-Type': 'application/json',

        },

        body: JSON.stringify({

          studentName: studentName.trim(),

          pickupTime,

          paymentMethod,

          demoPaymentSuccessful,

          items: cartItems.map((food) => ({

            id: food.id,

            quantity: cart[food.id],

          })),

        }),

      })



      const data = await response.json()



      if (!response.ok) {

        throw new Error(data.error || 'Unable to place your order.')

      }



      setOrderConfirmation({ ...data, pickupTime: data.pickupTime || pickupTime, paymentMethod: data.paymentMethod || paymentMethod, paymentStatus: data.paymentStatus || 'Unpaid' })
      setDemoPaymentOpen(false)
      setTrackingToken(String(data.token))
      setTrackingOrder(null)
      setTrackingError('')

      setCart({})

      setCartOpen(false)

      setStudentName('')

    } catch (error) {

      setNotice(

        error instanceof Error

          ? error.message

          : 'Unable to place your order. Please try again.',

      )

    } finally {

      setCheckoutLoading(false)

    }

  }



  return (

    <div className="app-shell">

      <header className="topbar">

        <a className="brand" href="#" aria-label="Smart Canteen home">

          <span className="brand-icon">S</span>

          <span>

            smart<span className="brand-accent">canteen</span>

          </span>

        </a>



        <nav className="nav-links" aria-label="Main navigation">

          <a className="nav-active" href="#menu">

            Menu

          </a>

          <a href="#how-it-works">How it works</a>
          <a href="#track-order">Track order</a>

        </nav>



        <button className="cart-button" onClick={() => setCartOpen(true)}>

          <span aria-hidden="true">🛍</span>

          My cart

          <span className="cart-count">{totalItems}</span>

        </button>

      </header>



      <main>

        <section className="hero">

          <div className="hero-copy">

            <span className="eyebrow">

              <span className="live-dot" /> YOUR CAMPUS, SERVED SMARTER

            </span>

            <h1>

              Less queue.

              <br />

              More <span>you-time.</span>

            </h1>

            <p>

              Your favourite campus food, ready when you are. Order ahead and

              spend your break doing what matters.

            </p>

            <a className="primary-button" href="#menu">

              Explore the menu <span aria-hidden="true">↗</span>

            </a>

            <div className="hero-points">

              <span>✓ Simple ordering</span>

              <span>✓ Numerical tokens</span>

              <span>✓ Quick pickup</span>

            </div>

          </div>



          <div className="hero-art">

            <img

              src="https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1000&q=85"

              alt="A fresh meal ready to enjoy"

            />

            <div className="floating-note">

              <span className="note-icon">◷</span>

              <span>

                <strong>Make breaks count</strong>

                <small>Order before you arrive</small>

              </span>

            </div>

            <div className="hero-sticker">

              GOOD FOOD

              <br />

              GOOD MOOD.

            </div>

          </div>

        </section>



        <section className="benefit-strip" id="how-it-works">

          <div>

            <span className="benefit-icon">⌁</span>

            <span>

              <strong>Skip the queue</strong>

              <small>Order ahead, save time</small>

            </span>

          </div>

          <div>

            <span className="benefit-icon">#</span>

            <span>

              <strong>Your own token</strong>

              <small>Know when to collect</small>

            </span>

          </div>

          <div>

            <span className="benefit-icon">↗</span>

            <span>

              <strong>Break-friendly</strong>

              <small>Find food for your schedule</small>

            </span>

          </div>

        </section>



        <section id="track-order" style={{ maxWidth: 1100, margin: '0 auto', padding: '36px 24px' }}>
        <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 20, padding: 24 }}>
          <span className="eyebrow">ORDER UPDATES</span>
          <h2 style={{ margin: '8px 0' }}>Track your order</h2>
          <p style={{ marginTop: 0, color: '#64748b' }}>Enter the pickup token from your order confirmation to see the latest status.</p>
          <form onSubmit={(event) => { event.preventDefault(); void trackOrder() }} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', maxWidth: 520 }}>
            <input aria-label="Pickup token" inputMode="numeric" value={trackingToken} onChange={(event) => setTrackingToken(event.target.value)} placeholder="e.g. 101" style={{ flex: '1 1 180px', minWidth: 0, padding: '13px 14px', border: '1px solid #d1d5db', borderRadius: 10, fontSize: 16 }} />
            <button className="primary-button" type="submit" disabled={trackingLoading}>{trackingLoading ? 'Checking…' : 'Track order'}</button>
          </form>
          {trackingError && <p role="alert" style={{ color: '#b91c1c', marginTop: 14 }}>{trackingError}</p>}
          {trackingOrder && (
            <div style={{ marginTop: 22, padding: 20, background: '#f0fdf4', borderRadius: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div><span style={{ color: '#166534', fontSize: 13, fontWeight: 700 }}>PICKUP TOKEN</span><div style={{ fontSize: 30, fontWeight: 800 }}>#{trackingOrder.token}</div></div>
                <span style={{ background: '#dcfce7', color: '#166534', padding: '8px 12px', borderRadius: 999, fontWeight: 700 }}>{trackingOrder.status}</span>
              </div>
              <p style={{ margin: '12px 0 6px' }}><strong>Pickup time:</strong> {formatPickupTime(trackingOrder.pickupTime)}</p>
              <p style={{ margin: '6px 0 18px' }}><strong>Payment:</strong> {trackingOrder.paymentMethod} · {trackingOrder.paymentStatus}</p>
              <h3 style={{ marginBottom: 8 }}>Your items</h3>
              {trackingOrder.items.map((item, index) => (
                <div key={`${item.name}-${index}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderBottom: '1px solid #d1fae5' }}>
                  <span>{item.name} × {item.quantity}</span><strong>₹{item.price * item.quantity}</strong>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, fontSize: 18 }}><strong>Total</strong><strong>₹{trackingOrder.total}</strong></div>
              <p style={{ color: '#64748b', fontSize: 13, marginBottom: 0 }}>Status refreshes automatically every 5 seconds.</p>
            </div>
          )}
        </div>
      </section>

      <section className="menu-section" id="menu">

          <div className="section-heading">

            <div>

              <span className="eyebrow">MADE FOR YOUR BREAK</span>

              <h2>What's cooking?</h2>

              <p>Good food, campus prices, less waiting.</p>

            </div>

            <div className="search-box">

              <span aria-hidden="true">⌕</span>

              <input

                value={search}

                onChange={(event) => setSearch(event.target.value)}

                placeholder="Search your cravings..."

                aria-label="Search food"

              />

              {search && (

                <button onClick={() => setSearch('')} aria-label="Clear search">

                  ×

                </button>

              )}

            </div>

          </div>



          <div className="category-list">

            {categories.map((item) => (

              <button

                key={item}

                className={`category-button ${category === item ? 'selected' : ''}`}

                onClick={() => setCategory(item)}

              >

                {item}

              </button>

            ))}

          </div>



          {menuLoading && <p role="status">Loading menu...</p>}



          {menuError && (

            <p className="menu-error" role="alert">

              {menuError}

            </p>

          )}



          {!menuLoading && !menuError && (

            <>

              <div className="food-grid">

                {visibleFoods.map((food) => (

                  <article className="food-card" key={food.id}>

                    <div className="food-image">

                      <img src={food.image} alt={food.name} loading="lazy" />

                      <span className="food-category">{food.category}</span>

                      {food.time === 0 && (

                        <span className="instant-tag">Ready to go</span>

                      )}

                    </div>

                    <div className="food-info">

                      <div className="food-title-row">

                        <h3>{food.name}</h3>

                        <strong className="food-price">₹{food.price}</strong>

                      </div>

                      <p>{food.description}</p>

                      <div className="food-card-bottom">

                        <span className="prep-time">

                          ◷{' '}

                          {food.time === 0

                            ? 'Instant pickup'

                            : `~${food.time} min prep`}

                        </span>

                        {(cart[food.id] ?? 0) === 0 ? (

                          <button

                            className="add-button"

                            onClick={() => changeQuantity(food.id, 1)}

                          >

                            + Add

                          </button>

                        ) : (

                          <div className="quantity-control">

                            <button

                              onClick={() => changeQuantity(food.id, -1)}

                              aria-label={`Remove one ${food.name}`}

                            >

                              −

                            </button>

                            <strong>{cart[food.id]}</strong>

                            <button

                              onClick={() => changeQuantity(food.id, 1)}

                              aria-label={`Add one ${food.name}`}

                            >

                              +

                            </button>

                          </div>

                        )}

                      </div>

                    </div>

                  </article>

                ))}

              </div>



              {visibleFoods.length === 0 && (

                <div className="empty-state">

                  <span>⌕</span>

                  <h3>No food found</h3>

                  <p>Try another search or category.</p>

                  <button

                    className="add-button"

                    onClick={() => {

                      setSearch('')

                      setCategory('All Items')

                    }}

                  >

                    Show all items

                  </button>

                </div>

              )}

            </>

          )}

        </section>



        {notice && (

          <div className="notice" role="status">

            <span>{notice}</span>

            <button

              onClick={() => setNotice('')}

              aria-label="Dismiss notice"

            >

              ×

            </button>

          </div>

        )}



        {orderConfirmation && (

          <section className="order-confirmation" role="status">

            <span className="eyebrow">ORDER CONFIRMED</span>

            <h2>Order placed successfully!</h2>

            <p>Thank you, {orderConfirmation.studentName}.</p>

            <p>Your pickup token is</p>

            <strong className="pickup-token">#{orderConfirmation.token}</strong>

            <p>Total: ₹{orderConfirmation.total}</p>
            <p><strong>Pickup time:</strong> {formatPickupTime(orderConfirmation.pickupTime || pickupTime)}</p>
            <p><strong>Payment method:</strong> {orderConfirmation.paymentMethod}</p>
            <p><strong>Payment status:</strong> {orderConfirmation.paymentStatus}</p>

            <button

              className="primary-button"

              onClick={() => setOrderConfirmation(null)}

            >

              Back to menu

            </button>

          </section>

        )}

      </main>



      <footer className="footer">

        <a className="brand" href="#">

          <span className="brand-icon">S</span>

          <span>

            smart<span className="brand-accent">canteen</span>

          </span>

        </a>

        <span>Made for better campus breaks.</span>

        <span>Student menu · Demo version</span>

      </footer>



      {cartOpen && (

        <div

          className="drawer-backdrop"

          onClick={() => setCartOpen(false)}

        >

          <aside

            className="cart-drawer"

            role="dialog"

            aria-modal="true"

            aria-label="Your shopping cart"

            onClick={(event) => event.stopPropagation()}

          >

            <div className="drawer-heading">

              <div>

                <span className="eyebrow">YOUR ORDER</span>

                <h2>Your cart</h2>

              </div>

              <button

                className="close-button"

                onClick={() => setCartOpen(false)}

                aria-label="Close cart"

              >

                ×

              </button>

            </div>



            {cartItems.length === 0 ? (

              <div className="empty-cart">

                <span>🛍</span>

                <h3>Your cart is hungry</h3>

                <p>Add something delicious from the menu.</p>

                <button

                  className="primary-button"

                  onClick={() => setCartOpen(false)}

                >

                  Explore menu

                </button>

              </div>

            ) : (

              <>

                <div className="cart-lines">

                  {cartItems.map((food) => (

                    <div className="cart-line" key={food.id}>

                      <img src={food.image} alt="" />

                      <div className="cart-line-info">

                        <strong>{food.name}</strong>

                        <span>₹{food.price} each</span>

                        <div className="quantity-control">

                          <button

                            onClick={() => changeQuantity(food.id, -1)}

                            aria-label={`Remove one ${food.name}`}

                          >

                            −

                          </button>

                          <strong>{cart[food.id]}</strong>

                          <button

                            onClick={() => changeQuantity(food.id, 1)}

                            aria-label={`Add one ${food.name}`}

                          >

                            +

                          </button>

                        </div>

                      </div>

                      <strong>₹{food.price * cart[food.id]}</strong>

                    </div>

                  ))}

                </div>

                <div className="cart-summary">

                  <label htmlFor="student-name">Your name</label>

                  <input

                    id="student-name"

                    type="text"

                    value={studentName}

                    onChange={(event) => setStudentName(event.target.value)}

                    placeholder="Enter your name"

                    autoComplete="name"

                    required

                  />

                  <label htmlFor="pickup-time" style={{ display: 'block', marginTop: 16 }}>Choose pickup time</label>
                  <select
                    id="pickup-time"
                    value={pickupTime}
                    onChange={(event) => setPickupTime(event.target.value)}
                    required
                    style={{ width: '100%', padding: '12px 14px', marginTop: 8, marginBottom: 16, border: '1px solid #d1d5db', borderRadius: 10, background: '#fff', fontSize: 16 }}
                  >
                    {pickupTimeSlots.map((time) => (
                      <option key={time} value={time}>{formatPickupTime(time)}</option>
                    ))}
                  </select>

                  <label htmlFor="payment-method" style={{ display: 'block', marginTop: 16 }}>Payment method</label>
                  <select
                    id="payment-method"
                    value={paymentMethod}
                    onChange={(event) => setPaymentMethod(event.target.value as 'Cash' | 'UPI')}
                    required
                    style={{ width: '100%', padding: '12px 14px', marginTop: 8, marginBottom: 16, border: '1px solid #d1d5db', borderRadius: 10, background: '#fff', fontSize: 16 }}
                  >
                    <option value="Cash">Cash at the counter</option>
                    <option value="UPI">UPI (staff will verify payment)</option>
                  </select>

                  <div>

                    <span>Items</span>

                    <strong>{totalItems}</strong>

                  </div>

                  <div>

                    <span>Estimated prep time</span>

                    <strong>

                      {pickupMinutes === 0 ? 'Instant' : `~${pickupMinutes} min`}

                    </strong>

                  </div>

                  <div className="total-line">

                    <span>Total</span>

                    <strong>₹{totalPrice}</strong>

                  </div>

                  <button

                    className="checkout-button"

                    onClick={() => {
                      if (!studentName.trim()) {
                        setNotice('Please enter your name before placing your order.')
                        return
                      }
                      if (totalItems === 0) {
                        setNotice('Please add at least one item to your cart.')
                        return
                      }
                      setNotice('')
                      if (paymentMethod === 'UPI') {
                        setDemoPaymentOpen(true)
                      } else {
                        void placeOrder(false)
                      }
                    }}

                    disabled={checkoutLoading}

                  >

                    {checkoutLoading ? 'Processing...' : paymentMethod === 'UPI' ? 'Continue to UPI payment' : 'Place order'}

                    {!checkoutLoading && <span>→</span>}

                  </button>

                  <p className="demo-disclaimer">

                    Hackathon demo only: Cash is collected at the counter. UPI opens a simulated payment screen; no real money is charged.

                  </p>

                </div>

              </>

            )}

          </aside>

        </div>

      )}

      {demoPaymentOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(15,23,42,0.62)', display: 'grid', placeItems: 'center', padding: 18 }}>
          <section role="dialog" aria-modal="true" aria-label="Demo UPI payment" style={{ width: '100%', maxWidth: 420, background: '#fff', borderRadius: 18, overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.25)', color: '#172033' }}>
            <div style={{ background: '#0b2545', color: '#fff', padding: '20px 24px' }}>
              <div style={{ fontSize: 13, opacity: 0.8 }}>SMART CANTEEN · DEMO CHECKOUT</div>
              <h2 style={{ margin: '8px 0 4px', fontSize: 24 }}>Secure payment</h2>
              <div style={{ fontSize: 13, opacity: 0.8 }}>Razorpay-style preview · No real payment</div>
            </div>
            <div style={{ padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                <span style={{ color: '#64748b' }}>Amount to pay</span>
                <strong style={{ fontSize: 28 }}>₹{totalPrice}</strong>
              </div>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 14, marginBottom: 18 }}>
                <div style={{ fontWeight: 700 }}>UPI payment</div>
                <div style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>Google Pay · PhonePe · Paytm (simulated)</div>
              </div>
              <p style={{ fontSize: 13, lineHeight: 1.5, color: '#64748b' }}>This is a hackathon demonstration. No UPI app will open and no money will be transferred.</p>
              <button type="button" onClick={() => void placeOrder(true)} disabled={checkoutLoading} style={{ width: '100%', padding: '14px 16px', border: 0, borderRadius: 10, background: '#2563eb', color: '#fff', fontWeight: 700, fontSize: 15, cursor: checkoutLoading ? 'wait' : 'pointer', marginTop: 8 }}>
                {checkoutLoading ? 'Processing demo payment…' : `Simulate successful payment · ₹${totalPrice}`}
              </button>
              <button type="button" onClick={() => setDemoPaymentOpen(false)} disabled={checkoutLoading} style={{ width: '100%', padding: 12, border: 0, background: 'transparent', color: '#475569', fontWeight: 600, cursor: 'pointer', marginTop: 6 }}>Cancel payment</button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}



function App() {

  if (window.location.pathname === '/staff') {

    return <StaffDashboard />

  }



  return <StudentApp />

}



export default App


