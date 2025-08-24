import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Sidebar } from '../../../../src/web-ui/components/navigation/Sidebar'
import { AuthProvider } from '../../../../src/web-ui/contexts/AuthContext'
import { ThemeProvider } from '../../../../src/web-ui/contexts/ThemeContext'

// Mock the auth context
const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
  picture: 'https://example.com/avatar.jpg'
}

jest.mock('../../../../src/web-ui/contexts/AuthContext', () => ({
  ...jest.requireActual('../../../../src/web-ui/contexts/AuthContext'),
  useAuth: () => ({
    user: mockUser,
    logout: jest.fn(),
    loading: false
  })
}))

// Mock localStorage and matchMedia
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: jest.fn(() => null),
    setItem: jest.fn(),
    clear: jest.fn()
  }
})

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

function renderSidebar(currentView = 'explore', onViewChange = jest.fn()) {
  return render(
    <ThemeProvider>
      <AuthProvider>
        <Sidebar currentView={currentView} onViewChange={onViewChange} />
      </AuthProvider>
    </ThemeProvider>
  )
}

describe('Sidebar', () => {
  it('should render with all navigation items', () => {
    renderSidebar()

    expect(screen.getByText('Explore')).toBeInTheDocument()
    expect(screen.getByText('Timeline')).toBeInTheDocument()
    expect(screen.getByText('Collections')).toBeInTheDocument()
    expect(screen.getByText('Add Memory')).toBeInTheDocument()
  })

  it('should highlight the current view', () => {
    renderSidebar('timeline')

    const timelineButton = screen.getByText('Timeline').closest('button')
    expect(timelineButton).toHaveClass('text-violet-600')
  })

  it('should call onViewChange when navigation item is clicked', async () => {
    const mockOnViewChange = jest.fn()
    const user = userEvent.setup()

    renderSidebar('explore', mockOnViewChange)

    await user.click(screen.getByText('Timeline'))
    expect(mockOnViewChange).toHaveBeenCalledWith('timeline')
  })

  it('should display user information', () => {
    renderSidebar()

    expect(screen.getByText('Test User')).toBeInTheDocument()
    expect(screen.getByText('test@example.com')).toBeInTheDocument()
  })

  it('should allow toggling collapse state', async () => {
    const user = userEvent.setup()
    renderSidebar()

    // Find collapse button (has transform class when collapsed)
    const collapseButton = screen.getByRole('button', { name: /collapse/i })
    await user.click(collapseButton)

    // After collapse, text should be hidden and sidebar should be narrow
    const sidebar = screen.getByText('Explore').closest('div')?.closest('div')
    expect(sidebar).toHaveClass('w-16')
  })

  it('should show theme toggle', () => {
    renderSidebar()

    // Theme toggle should be present (has specific icons for light/dark/system)
    const themeToggle = screen.getByRole('button', { name: /theme/i })
    expect(themeToggle).toBeInTheDocument()
  })

  it('should have logout functionality', () => {
    renderSidebar()

    const logoutButton = screen.getByTitle('Sign out')
    expect(logoutButton).toBeInTheDocument()
  })

  it('should display correct descriptions for navigation items', () => {
    renderSidebar()

    expect(screen.getByText('Discover your memories')).toBeInTheDocument()
    expect(screen.getByText('Chronological view')).toBeInTheDocument()
    expect(screen.getByText('Organized by topic')).toBeInTheDocument()
    expect(screen.getByText('Capture new thoughts')).toBeInTheDocument()
  })

  it('should show proper branding', () => {
    renderSidebar()

    expect(screen.getByText('Memory')).toBeInTheDocument()
    expect(screen.getByText('AI Knowledge Base')).toBeInTheDocument()
  })

  it('should render navigation icons', () => {
    renderSidebar()

    // Check that SVG icons are present for each nav item
    const buttons = screen.getAllByRole('button')
    const navButtons = buttons.filter(button => 
      button.textContent?.includes('Explore') ||
      button.textContent?.includes('Timeline') ||
      button.textContent?.includes('Collections') ||
      button.textContent?.includes('Add Memory')
    )

    navButtons.forEach(button => {
      const svg = button.querySelector('svg')
      expect(svg).toBeInTheDocument()
    })
  })

  describe('Collapsed state', () => {
    it('should hide text labels when collapsed', async () => {
      const user = userEvent.setup()
      renderSidebar()

      const collapseButton = screen.getByRole('button', { name: /collapse/i })
      await user.click(collapseButton)

      // Text should be hidden but icons should still be visible
      expect(screen.queryByText('Discover your memories')).not.toBeInTheDocument()
      expect(screen.queryByText('Chronological view')).not.toBeInTheDocument()
    })

    it('should show tooltips in collapsed state', async () => {
      const user = userEvent.setup()
      renderSidebar()

      const collapseButton = screen.getByRole('button', { name: /collapse/i })
      await user.click(collapseButton)

      // In collapsed state, buttons should still be clickable
      const buttons = screen.getAllByRole('button')
      const exploreButton = buttons.find(button => 
        button.querySelector('svg') && !button.textContent?.includes('Memory')
      )
      
      expect(exploreButton).toBeInTheDocument()
    })
  })
})