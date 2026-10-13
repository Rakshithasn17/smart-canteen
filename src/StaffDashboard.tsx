import { useCallback, useEffect, useState, type FormEvent, type CSSProperties } from 'react'



import './StaffDashboard.css'







type OrderItem = {



  name: string



  quantity: number



  price: number



}







type Order = {



  id: number



  token: number



  studentName: string



  total: number



  status: string



  pickupTime: string



  paymentMethod: string



  paymentStatus: string



  createdAt: string



  items: OrderItem[]



}







type MenuItem = {

  id: number

  name: string

  category: string

  price: number

  description: string

  prep_time: number

  image: string

  available: number

}



type MenuForm = {

  name: string

  category: string

  price: string

  description: string

  prep_time: string

  image: string

}



const emptyMenuForm: MenuForm = {

  name: '',

  category: 'Snacks',

  price: '',

  description: '',

  prep_time: '10',

  image: '',

}



type LoginResponse = {



  token?: string



  username?: string



  error?: string



}







const API = 'http\://localhost:3001/api'



const TOKEN_KEY = 'smartCanteenStaffToken'



const USER_KEY = 'smartCanteenStaffUsername'



const statuses = ['Pending', 'Preparing', 'Ready', 'Completed', 'Cancelled']







const menuInputStyle: CSSProperties = {

  width: '100%',

  boxSizing: 'border-box',

  padding: '12px 14px',

  border: '1px solid #dce6dc',

  borderRadius: 9,

  background: '#fff',

  color: '#20352b',

  font: 'inherit',

}



function formatStaffPickupTime(value: string) {

  if (!value || !/^\d{2}:\d{2}$/.test(value)) return value || 'Not set'

  const [hours, minutes] = value.split(':').map(Number)

  const suffix = hours >= 12 ? 'PM' : 'AM'

  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${suffix}`

}



export default function StaffDashboard() {



  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || '')



  const [username, setUsername] = useState(() => localStorage.getItem(USER_KEY) || '')



  const [loginUsername, setLoginUsername] = useState('')



  const [loginPassword, setLoginPassword] = useState('')



  const [loginLoading, setLoginLoading] = useState(false)



  const [loginError, setLoginError] = useState('')



  const [orders, setOrders] = useState<Order[]>([])

  const [orderFilter, setOrderFilter] = useState('All')



  const [loading, setLoading] = useState(false)



  const [error, setError] = useState('')

  const [menuItems, setMenuItems] = useState<MenuItem[]>([])

  const [menuLoading, setMenuLoading] = useState(false)

  const [menuError, setMenuError] = useState('')

  const [menuSuccess, setMenuSuccess] = useState('')

  const [menuForm, setMenuForm] = useState<MenuForm>(emptyMenuForm)

  const [editingMenuId, setEditingMenuId] = useState<number | null>(null)

  const [menuSaving, setMenuSaving] = useState(false)







  const logout = useCallback(() => {



    localStorage.removeItem(TOKEN_KEY)



    localStorage.removeItem(USER_KEY)



    setToken('')



    setUsername('')



    setOrders([])



    setError('')



    setLoginPassword('')



  }, [])







  async function handleLogin(event: FormEvent<HTMLFormElement>) {



    event.preventDefault()



    setLoginLoading(true)



    setLoginError('')







    try {



      const response = await fetch(`${API}/staff/login`, {



        method: 'POST',



        headers: { 'Content-Type': 'application/json' },



        body: JSON.stringify({ username: loginUsername.trim(), password: loginPassword }),



      })



      const data = (await response.json()) as LoginResponse



      if (!response.ok || !data.token || !data.username) {



        throw new Error(data.error || 'Unable to sign in.')



      }







      localStorage.setItem(TOKEN_KEY, data.token)



      localStorage.setItem(USER_KEY, data.username)



      setToken(data.token)



      setUsername(data.username)



      setLoginPassword('')



    } catch (err) {



      setLoginError(err instanceof Error ? err.message : 'Unable to sign in. Check that the backend is running.')



    } finally {



      setLoginLoading(false)



    }



  }







  const loadOrders = useCallback(async () => {



    if (!token) return







    try {



      const response = await fetch(`${API}/orders`, {



        headers: { Authorization: `Bearer ${token}` },



      })







      if (response.status === 401) {



        logout()



        setLoginError('Your staff session expired. Please sign in again.')



        return



      }



      if (!response.ok) {



        const data = await response.json().catch(() => ({})) as { error?: string }



        throw new Error(data.error || 'Could not load orders.')



      }







      const data = (await response.json()) as Order[]



      setOrders(data)



      setError('')



    } catch (err) {



      setError(err instanceof Error ? err.message : 'Cannot connect to the backend. Make sure the server is running on port 3001.')



    } finally {



      setLoading(false)



    }



  }, [token, logout])







  async function updateStatus(id: number, status: string) {



    try {



      const response = await fetch(`${API}/orders/${id}/status`, {



        method: 'PATCH',



        headers: {



          'Content-Type': 'application/json',



          Authorization: `Bearer ${token}`,



        },



        body: JSON.stringify({ status }),



      })



      const data = await response.json() as { error?: string }







      if (response.status === 401) {



        logout()



        setLoginError('Your staff session expired. Please sign in again.')



        return



      }



      if (!response.ok) throw new Error(data.error || 'Could not update status.')



      await loadOrders()



    } catch (err) {



      alert(err instanceof Error ? err.message : 'Could not update status.')



    }



  }







  async function updatePaymentStatus(id: number, paymentStatus: 'Paid' | 'Unpaid') {

    try {

      const response = await fetch(`${API}/orders/${id}/payment`, {

        method: 'PATCH',

        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },

        body: JSON.stringify({ paymentStatus }),

      })

      const data = await response.json() as { error?: string }

      if (response.status === 401) {

        logout()

        setLoginError('Your staff session expired. Please sign in again.')

        return

      }

      if (!response.ok) throw new Error(data.error || 'Could not update payment status.')

      await loadOrders()

    } catch (err) {

      alert(err instanceof Error ? err.message : 'Could not update payment status.')

    }

  }



  const menuRequest = useCallback(async (path: string, options: RequestInit = {}) => {

    const response = await fetch(`${API}${path}`, {

      ...options,

      headers: {

        Authorization: `Bearer ${token}`,

        ...(options.body ? { 'Content-Type': 'application/json' } : {}),

        ...options.headers,

      },

    })

    const data = await response.json().catch(() => ({}))

    if (response.status === 401) {

      logout()

      throw new Error('Your staff session expired. Please sign in again.')

    }

    if (!response.ok) throw new Error(data.error || 'Menu request failed.')

    return data

  }, [token, logout])



  const loadMenu = useCallback(async () => {

    if (!token) return

    setMenuLoading(true)

    try {

      const data = await menuRequest('/staff/menu')

      setMenuItems(data as MenuItem[])

      setMenuError('')

    } catch (err) {

      setMenuError(err instanceof Error ? err.message : 'Could not load menu items.')

    } finally {

      setMenuLoading(false)

    }

  }, [token, menuRequest])



  function beginEdit(item: MenuItem) {

    setEditingMenuId(item.id)

    setMenuSuccess('')

    setMenuError('')

    setMenuForm({

      name: item.name,

      category: item.category,

      price: String(item.price),

      description: item.description,

      prep_time: String(item.prep_time),

      image: item.image || '',

    })

    window.scrollTo({ top: 0, behavior: 'smooth' })

  }



  function resetMenuForm() {

    setEditingMenuId(null)

    setMenuForm(emptyMenuForm)

  }



  async function saveMenuItem(event: FormEvent<HTMLFormElement>) {

    event.preventDefault()

    setMenuSaving(true)

    setMenuError('')

    setMenuSuccess('')

    try {

      const payload = {

        name: menuForm.name.trim(),

        category: menuForm.category.trim(),

        price: Number(menuForm.price),

        description: menuForm.description.trim(),

        prep_time: Number(menuForm.prep_time),

        image: menuForm.image.trim(),

      }

      const path = editingMenuId === null

        ? '/staff/menu'

        : `/staff/menu/${editingMenuId}`

      const data = await menuRequest(path, {

        method: editingMenuId === null ? 'POST' : 'PATCH',

        body: JSON.stringify(payload),

      })

      setMenuSuccess(editingMenuId === null ? 'Food item added successfully.' : 'Food item updated successfully.')

      resetMenuForm()

      await loadMenu()

    } catch (err) {

      setMenuError(err instanceof Error ? err.message : 'Could not save menu item.')

    } finally {

      setMenuSaving(false)

    }

  }



  async function toggleAvailability(item: MenuItem) {

    setMenuError('')

    setMenuSuccess('')

    try {

      await menuRequest(`/staff/menu/${item.id}`, {

        method: 'PATCH',

        body: JSON.stringify({ available: item.available ? 0 : 1 }),

      })

      setMenuSuccess(`${item.name} is now ${item.available ? 'unavailable' : 'available'}.`)

      await loadMenu()

    } catch (err) {

      setMenuError(err instanceof Error ? err.message : 'Could not update availability.')

    }

  }



  useEffect(() => {



    if (!token) {



      setLoading(false)



      return



    }







    setLoading(true)



    void loadOrders()



    const timer = window.setInterval(() => void loadOrders(), 10000)



    return () => window.clearInterval(timer)



  }, [token, loadOrders, loadMenu])







  if (!token) {



    return (



      <main className="staff-page staff-login-page">



        <section className="staff-login-card">



          <div className="staff-login-mark" aria-hidden="true">SC</div>



          <p className="staff-eyebrow">SMART CAMPUS · STAFF PORTAL</p>



          <h1>Staff sign in</h1>



          <p className="staff-subtitle">Sign in to manage canteen orders and pickup tokens.</p>







          <form className="staff-login-form" onSubmit={handleLogin}>



            <label htmlFor="staff-username">Username</label>



            <input



              id="staff-username"



              autoComplete="username"



              value={loginUsername}



              onChange={event => setLoginUsername(event.target.value)}



              placeholder="Enter staff username"



              required



            />







            <label htmlFor="staff-password">Password</label>



            <input



              id="staff-password"



              type="password"



              autoComplete="current-password"



              value={loginPassword}



              onChange={event => setLoginPassword(event.target.value)}



              placeholder="Enter staff password"



              required



            />







            {loginError && <p className="staff-login-error" role="alert">{loginError}</p>}







            <button className="staff-refresh staff-login-submit" type="submit" disabled={loginLoading}>



              {loginLoading ? 'Signing in…' : 'Sign in to dashboard'}



            </button>



          </form>



          <p className="staff-login-note">Staff access only. Use the credentials configured by your administrator.</p>



        </section>



      </main>



    )



  }







  const pending = orders.filter(order => order.status === 'Pending').length



  const preparing = orders.filter(order => order.status === 'Preparing').length



  const completed = orders.filter(order => order.status === 'Completed').length



  const revenue = orders



    .filter(order => order.status !== 'Cancelled')



    .reduce((sum, order) => sum + order.total, 0)







  const filteredOrders = orderFilter === 'All'
    ? orders
    : orders.filter(order => order.status === orderFilter)

  function jumpToOrders(filter: string) {
    setOrderFilter(filter)
    window.setTimeout(() => {
      document.getElementById('incoming-orders')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }, 0)
  }

  return (



    <main className="staff-page">



      <header className="staff-header">



        <div>



          <p className="staff-eyebrow">SMART CAMPUS · STAFF PORTAL</p>



          <h1>Staff Dashboard</h1>



          <p className="staff-subtitle">Manage canteen orders and pickup tokens.</p>



          <p className="staff-welcome">Signed in as <strong>{username}</strong></p>



        </div>



        <div className="staff-header-actions">



          <button className="staff-refresh" onClick={() => void loadOrders()}>↻ Refresh orders</button>



          <button className="staff-logout" onClick={logout}>Log out</button>



        </div>



      </header>







      <section className="staff-stats" aria-label="Order summaries">
        <button type="button" className="staff-stat" onClick={() => jumpToOrders('All')} style={{ cursor: 'pointer', textAlign: 'left', font: 'inherit' }} title="View all orders">
          <span>Total orders</span><strong>{orders.length}</strong>
        </button>
        <button type="button" className="staff-stat" onClick={() => jumpToOrders('Pending')} style={{ cursor: 'pointer', textAlign: 'left', font: 'inherit' }} title="View pending orders">
          <span>Pending</span><strong>{pending}</strong>
        </button>
        <button type="button" className="staff-stat" onClick={() => jumpToOrders('Preparing')} style={{ cursor: 'pointer', textAlign: 'left', font: 'inherit' }} title="View orders being prepared">
          <span>Preparing</span><strong>{preparing}</strong>
        </button>
        <button type="button" className="staff-stat" onClick={() => jumpToOrders('Completed')} style={{ cursor: 'pointer', textAlign: 'left', font: 'inherit' }} title="View completed orders">
          <span>Completed</span><strong>{completed}</strong>
        </button>
        <button type="button" className="staff-stat" onClick={() => jumpToOrders('All')} style={{ cursor: 'pointer', textAlign: 'left', font: 'inherit' }} title="View all orders">
          <span>Order value</span><strong>₹{revenue}</strong>
        </button>
      </section>







      <section className="staff-orders" style={{ marginBottom: 24 }}>

        <div className="staff-orders-heading">

          <div>

            <h2>Menu Management</h2>

            <p>Add food, update prices, and manage sold-out items.</p>

          </div>

          <button className="staff-refresh" type="button" onClick={() => { resetMenuForm(); setMenuError(''); setMenuSuccess('') }}>

            + Add food item

          </button>

        </div>



        <form onSubmit={saveMenuItem} style={{ padding: 24, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>

          <label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>

            Food name

            <input required maxLength={100} value={menuForm.name} onChange={e => setMenuForm({ ...menuForm, name: e.target.value })} placeholder="e.g. Veg Puff" style={menuInputStyle} />

          </label>

          <label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>

            Category

            <select required value={menuForm.category} onChange={e => setMenuForm({ ...menuForm, category: e.target.value })} style={menuInputStyle}>

              {['Breakfast', 'Snacks', 'Meals', 'Drinks', 'Desserts', 'Other'].map(category => <option key={category} value={category}>{category}</option>)}

            </select>

          </label>

          <label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>

            Price (₹)

            <input required type="number" min="0" max="100000" step="1" value={menuForm.price} onChange={e => setMenuForm({ ...menuForm, price: e.target.value })} placeholder="40" style={menuInputStyle} />

          </label>

          <label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>

            Preparation time (minutes)

            <input required type="number" min="0" max="240" step="1" value={menuForm.prep_time} onChange={e => setMenuForm({ ...menuForm, prep_time: e.target.value })} style={menuInputStyle} />

          </label>

          <label style={{ display: 'grid', gap: 6, fontWeight: 600, gridColumn: '1 / -1' }}>

            Description

            <input required maxLength={500} value={menuForm.description} onChange={e => setMenuForm({ ...menuForm, description: e.target.value })} placeholder="Short description of the food item" style={menuInputStyle} />

          </label>

          <label style={{ display: 'grid', gap: 6, fontWeight: 600, gridColumn: '1 / -1' }}>

            Image URL (optional)

            <input type="url" value={menuForm.image} onChange={e => setMenuForm({ ...menuForm, image: e.target.value })} placeholder="https\://..." style={menuInputStyle} />

          </label>

          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, flexWrap: 'wrap' }}>

            <button className="staff-refresh" type="submit" disabled={menuSaving}>{menuSaving ? 'Saving…' : editingMenuId === null ? 'Save food item' : 'Save changes'}</button>

            {editingMenuId !== null && <button className="staff-logout" type="button" onClick={resetMenuForm}>Cancel edit</button>}

          </div>

          {menuError && <p role="alert" style={{ gridColumn: '1 / -1', color: '#b42318', margin: 0 }}>{menuError}</p>}

          {menuSuccess && <p role="status" style={{ gridColumn: '1 / -1', color: '#23704b', margin: 0 }}>{menuSuccess}</p>}

        </form>



        {menuLoading && <p className="staff-message">Loading menu items…</p>}

        {!menuLoading && menuItems.length === 0 && !menuError && <p className="staff-message">No menu items found.</p>}

        {menuItems.length > 0 && (

          <div className="staff-table-wrap">

            <table className="staff-table">

              <thead><tr><th>Food</th><th>Category</th><th>Price</th><th>Prep time</th><th>Availability</th><th>Actions</th></tr></thead>

              <tbody>

                {menuItems.map(item => (

                  <tr key={item.id}>

                    <td><strong>{item.name}</strong><div style={{ color: '#78877e', fontSize: 12, marginTop: 4 }}>{item.description}</div></td>

                    <td>{item.category}</td>

                    <td>₹{item.price}</td>

                    <td>{item.prep_time} min</td>

                    <td><span className={`staff-status ${item.available ? 'status-completed' : 'status-cancelled'}`}>{item.available ? 'Available' : 'Sold out'}</span></td>

                    <td><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>

                      <button className="staff-logout" type="button" onClick={() => beginEdit(item)}>Edit</button>

                      <button className="staff-status-select" type="button" onClick={() => void toggleAvailability(item)}>{item.available ? 'Mark sold out' : 'Make available'}</button>

                    </div></td>

                  </tr>

                ))}

              </tbody>

            </table>

          </div>

        )}

      </section>



      <section className="staff-orders" id="incoming-orders" style={{ scrollMarginTop: 24 }}>



        <div className="staff-orders-heading">



          <div>
            <h2>Incoming orders{orderFilter !== 'All' ? ` — ${orderFilter}` : ''}</h2>
            <p>{orderFilter === 'All' ? 'Recent orders from students' : `Showing ${orders.filter(order => order.status === orderFilter).length} ${orderFilter.toLowerCase()} order(s)`}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {orderFilter !== 'All' && <button type="button" className="staff-refresh" onClick={() => setOrderFilter('All')}>Show all orders</button>}
            <span className="staff-live">● Auto-refreshes every 10 sec</span>
          </div>



        </div>







        {loading && <p className="staff-message">Loading orders...</p>}



        {!loading && error && (



          <div className="staff-error"><p>{error}</p><button onClick={() => void loadOrders()}>Try again</button></div>



        )}



        {!loading && !error && orders.length === 0 && (



          <p className="staff-message">No orders yet. New student orders will appear here.</p>



        )}



        {!loading && !error && orders.length > 0 && (



          <div className="staff-table-wrap">



            <table className="staff-table">



              <thead><tr><th>Pickup token</th><th>Student</th><th>Items</th><th>Total</th><th>Pickup time</th><th>Payment</th><th>Placed at</th><th>Status</th><th>Update</th></tr></thead>



              <tbody>



                {filteredOrders.map(order => (



                  <tr key={order.id}>



                    <td><strong className="staff-token">#{order.token}</strong></td>



                    <td>{order.studentName}</td>



                    <td><div className="staff-item-list">{order.items.map((item, index) => <span key={`${item.name}-${index}`}>{item.name} × {item.quantity}</span>)}</div></td>



                    <td><strong>₹{order.total}</strong></td>



                    <td><strong>{formatStaffPickupTime(order.pickupTime)}</strong></td>



                    <td>

                      <div style={{ display: 'grid', gap: 6, minWidth: 115 }}>

                        <strong>{order.paymentMethod}</strong>

                        <span style={{ color: order.paymentStatus === 'Paid' ? '#166534' : '#b45309', fontWeight: 700 }}>{order.paymentStatus}</span>

                        <button type="button" className="staff-refresh" style={{ padding: '6px 8px', fontSize: 12 }} onClick={() => void updatePaymentStatus(order.id, order.paymentStatus === 'Paid' ? 'Unpaid' : 'Paid')}>{order.paymentStatus === 'Paid' ? 'Mark unpaid' : 'Mark paid'}</button>

                      </div>

                    </td>



                    <td>{new Date(`${order.createdAt.replace(' ', 'T')}Z`).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>



                    <td><span className={`staff-status status-${order.status.toLowerCase()}`}>{order.status}</span></td>



                    <td>



                      <select className="staff-status-select" value={order.status} onChange={event => void updateStatus(order.id, event.target.value)} aria-label={`Update order ${order.token} status`}>



                        {statuses.map(status => <option key={status} value={status}>{status}</option>)}



                      </select>



                    </td>



                  </tr>



                ))}



              </tbody>



            </table>



          </div>



        )}



      </section>



      <footer className="staff-footer">Smart Canteen · Order management</footer>



    </main>



  )



}




