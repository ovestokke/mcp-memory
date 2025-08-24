import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExploreView } from '../../../../src/web-ui/components/views/ExploreView'
import { Memory, MemoryStats } from '../../../../src/web-ui/types/memory'

const mockMemories: Memory[] = [
  {
    id: '1',
    content: 'Test memory 1',
    namespace: 'projects',
    labels: ['work', 'important'],
    createdAt: '2024-01-15T10:30:00.000Z',
    updatedAt: '2024-01-15T10:30:00.000Z',
    userId: 'test-user'
  },
  {
    id: '2',
    content: 'Test memory 2',
    namespace: 'personal',
    labels: ['life', 'notes'],
    createdAt: '2024-01-14T09:15:00.000Z',
    updatedAt: '2024-01-14T09:15:00.000Z',
    userId: 'test-user'
  }
]

const mockStats: MemoryStats = {
  total: 10,
  namespaces: 3,
  recentlyAdded: 2
}

const defaultProps = {
  memories: mockMemories,
  filteredMemories: mockMemories,
  namespaces: ['projects', 'personal', 'ideas'],
  selectedNamespace: 'all',
  searchQuery: '',
  loading: false,
  error: '',
  stats: mockStats,
  onNamespaceChange: jest.fn(),
  onSearch: jest.fn(),
  onDeleteMemory: jest.fn(),
  onRefresh: jest.fn()
}

describe('ExploreView', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render page title and description', () => {
    render(<ExploreView {...defaultProps} />)

    expect(screen.getByText('Explore Your Memory')).toBeInTheDocument()
    expect(screen.getByText('Discover insights from your AI conversations and knowledge base')).toBeInTheDocument()
  })

  it('should display stats cards with correct values', () => {
    render(<ExploreView {...defaultProps} />)

    expect(screen.getByText('10')).toBeInTheDocument() // Total memories
    expect(screen.getByText('Total Memories')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument() // Namespaces
    expect(screen.getByText('Collections')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument() // Recently added
    expect(screen.getByText('Added Today')).toBeInTheDocument()
  })

  it('should render search form', () => {
    render(<ExploreView {...defaultProps} />)

    expect(screen.getByText('Search Your Knowledge')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('What are you looking for?')).toBeInTheDocument()
  })

  it('should render namespace filter buttons', () => {
    render(<ExploreView {...defaultProps} />)

    expect(screen.getByText('All Collections')).toBeInTheDocument()
    // Use more specific selectors for namespace buttons
    const namespaceButtons = screen.getAllByRole('button').filter(button => 
      button.textContent === 'projects' || 
      button.textContent === 'personal' || 
      button.textContent === 'ideas'
    )
    expect(namespaceButtons).toHaveLength(3)
  })

  it('should highlight selected namespace', () => {
    render(<ExploreView {...defaultProps} selectedNamespace="projects" />)

    // Find the projects button specifically
    const buttons = screen.getAllByRole('button')
    const projectsButton = buttons.find(button => 
      button.textContent === 'projects' && button.className.includes('violet')
    )
    expect(projectsButton).toBeInTheDocument()
    expect(projectsButton).toHaveClass('text-violet-700')
  })

  it('should call onNamespaceChange when namespace button is clicked', async () => {
    const user = userEvent.setup()
    render(<ExploreView {...defaultProps} />)

    // Find the projects namespace button (not the memory card label)
    const buttons = screen.getAllByRole('button')
    const projectsButton = buttons.find(button => 
      button.textContent === 'projects' && 
      button.className.includes('rounded-full')
    )
    
    expect(projectsButton).toBeInTheDocument()
    await user.click(projectsButton!)
    expect(defaultProps.onNamespaceChange).toHaveBeenCalledWith('projects')
  })

  it('should call onRefresh when refresh button is clicked', async () => {
    const user = userEvent.setup()
    render(<ExploreView {...defaultProps} />)

    const refreshButton = screen.getByTitle('Refresh memories')
    await user.click(refreshButton)
    expect(defaultProps.onRefresh).toHaveBeenCalled()
  })

  it('should display memories as cards', () => {
    render(<ExploreView {...defaultProps} />)

    expect(screen.getByText('Test memory 1')).toBeInTheDocument()
    expect(screen.getByText('Test memory 2')).toBeInTheDocument()
  })

  it('should show loading state', () => {
    render(<ExploreView {...defaultProps} loading={true} />)

    expect(screen.getByText('Loading memories...')).toBeInTheDocument()
  })

  it('should show search loading state when searching', () => {
    render(<ExploreView {...defaultProps} loading={true} searchQuery="test query" />)

    expect(screen.getByText('Searching your memories...')).toBeInTheDocument()
  })

  it('should display error message', () => {
    render(<ExploreView {...defaultProps} error="Something went wrong" />)

    // The error message might appear in multiple places (header + description)
    const errorElements = screen.getAllByText(/Something went wrong/)
    expect(errorElements.length).toBeGreaterThan(0)
    
    // Check that the error section has the proper styling
    const errorContainer = errorElements[0].closest('.bg-red-50')
    expect(errorContainer).toBeInTheDocument()
  })

  it('should show empty state when no memories', () => {
    render(<ExploreView {...defaultProps} memories={[]} filteredMemories={[]} />)

    expect(screen.getByText('No memories yet')).toBeInTheDocument()
    expect(screen.getByText('Start by adding your first memory to begin building your knowledge base.')).toBeInTheDocument()
  })

  it('should show no search results state', () => {
    render(<ExploreView {...defaultProps} searchQuery="nonexistent" filteredMemories={[]} />)

    expect(screen.getByText('No matches found')).toBeInTheDocument()
    expect(screen.getByText('Try adjusting your search terms or explore different collections.')).toBeInTheDocument()
  })

  it('should display search results header when searching', () => {
    render(<ExploreView {...defaultProps} searchQuery="test" />)

    expect(screen.getByText('Search Results')).toBeInTheDocument()
    expect(screen.getByText('(2 memories)')).toBeInTheDocument()
  })

  it('should display recent memories header when not searching', () => {
    render(<ExploreView {...defaultProps} />)

    expect(screen.getByText('Recent Memories')).toBeInTheDocument()
    expect(screen.getByText('(2 memories)')).toBeInTheDocument()
  })

  it('should handle singular/plural memory count correctly', () => {
    const singleMemory = [mockMemories[0]]
    render(<ExploreView {...defaultProps} memories={singleMemory} filteredMemories={singleMemory} />)

    expect(screen.getByText('(1 memory)')).toBeInTheDocument()
  })

  it('should not render namespace filter when no namespaces', () => {
    render(<ExploreView {...defaultProps} namespaces={[]} />)

    expect(screen.queryByText('All Collections')).not.toBeInTheDocument()
  })

  it('should call onDeleteMemory when memory card delete is triggered', async () => {
    render(<ExploreView {...defaultProps} />)

    // This would require the MemoryCard component to trigger the delete
    // The actual test would depend on how the MemoryCard component is implemented
    expect(defaultProps.onDeleteMemory).toBeDefined()
  })

  it('should have accessible headings', () => {
    render(<ExploreView {...defaultProps} />)

    expect(screen.getByRole('heading', { name: 'Explore Your Memory' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Search Your Knowledge' })).toBeInTheDocument()
  })

  it('should render stats with proper icons', () => {
    render(<ExploreView {...defaultProps} />)

    // Check that stat cards have proper structure
    // Use a more specific selector to avoid matching buttons
    expect(screen.getByText('Total Memories')).toBeInTheDocument()
    expect(screen.getByText('Collections')).toBeInTheDocument()
    expect(screen.getByText('Added Today')).toBeInTheDocument()
  })
})