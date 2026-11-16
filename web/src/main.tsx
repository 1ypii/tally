import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { AuthProvider } from './auth'
import { FeedbackProvider } from './feedback'
import { applyTheme, GlobalStyle } from './ui'
import Layout from './pages/Layout'
import Login from './pages/Login'
import Overview from './pages/Overview'
import Clients from './pages/Clients'
import Invoices from './pages/Invoices'
import Books from './pages/Books'
import Shared from './pages/Shared'
import IncomePage from './pages/IncomePage'
import Settings from './pages/Settings'
import ClientPage from './pages/ClientPage'
import InvoiceEdit from './pages/InvoiceEdit'
import InvoiceView from './pages/InvoiceView'

applyTheme()

const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  { path: '/i/:token', element: <Shared /> },
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Overview /> },
      { path: 'clients', element: <Clients /> },
      { path: 'clients/:id', element: <ClientPage /> },
      { path: 'books', element: <Books /> },
      { path: 'income', element: <IncomePage /> },
      { path: 'settings', element: <Settings /> },
      { path: 'invoices', element: <Invoices /> },
      { path: 'invoices/new', element: <InvoiceEdit /> },
      { path: 'invoices/:id', element: <InvoiceView /> },
      { path: 'invoices/:id/edit', element: <InvoiceEdit /> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GlobalStyle />
    <AuthProvider>
      <FeedbackProvider>
        <RouterProvider router={router} />
      </FeedbackProvider>
    </AuthProvider>
  </StrictMode>,
)
