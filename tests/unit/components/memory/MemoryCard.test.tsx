import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryCard } from '../../../../src/web-ui/components/memory/MemoryCard'
import { Memory } from '../../../../src/web-ui/types/memory'

const mockMemory: Memory = {
  id: 'test-memory-id',
  content: 'This is a test memory content that should be displayed in the card. It contains enough text to test the truncation feature when the content is longer than the maximum display length.',
  namespace: 'test-namespace',
  labels: ['test', 'memory', 'example'],
  createdAt: '2024-01-15T10:30:00.000Z',
  updatedAt: '2024-01-15T10:30:00.000Z',
  userId: 'test-user-id'
}

const mockShortMemory: Memory = {
  ...mockMemory,
  content: 'Short memory content',
  labels: []
}

describe('MemoryCard', () => {
  const mockOnDelete = jest.fn()

  beforeEach(() => {
    mockOnDelete.mockClear()
    // Mock window.confirm
    global.confirm = jest.fn(() => true)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('should render memory content', () => {
    render(<MemoryCard memory={mockMemory} onDelete={mockOnDelete} />)

    expect(screen.getByText(/This is a test memory content/)).toBeInTheDocument()
  })

  it('should display namespace with proper styling', () => {
    render(<MemoryCard memory={mockMemory} onDelete={mockOnDelete} />)

    expect(screen.getByText('test-namespace')).toBeInTheDocument()
  })

  it('should display formatted creation date', () => {
    render(<MemoryCard memory={mockMemory} onDelete={mockOnDelete} />)

    // Should show formatted date
    expect(screen.getByText(/Jan 15, 2024/)).toBeInTheDocument()
  })

  it('should display labels when present', () => {
    render(<MemoryCard memory={mockMemory} onDelete={mockOnDelete} />)

    expect(screen.getByText('test')).toBeInTheDocument()
    expect(screen.getByText('memory')).toBeInTheDocument()
    expect(screen.getByText('example')).toBeInTheDocument()
  })

  it('should not display labels section when no labels', () => {
    render(<MemoryCard memory={mockShortMemory} onDelete={mockOnDelete} />)

    // Labels section should not be present
    const labelIcon = screen.queryByTestId('label-icon')
    expect(labelIcon).not.toBeInTheDocument()
  })

  it('should truncate long content and show "Show more" button', () => {
    render(<MemoryCard memory={mockMemory} onDelete={mockOnDelete} />)

    expect(screen.getByText('Show more')).toBeInTheDocument()
    expect(screen.getByText(/\.\.\./)).toBeInTheDocument()
  })

  it('should expand content when "Show more" is clicked', async () => {
    const user = userEvent.setup()
    render(<MemoryCard memory={mockMemory} onDelete={mockOnDelete} />)

    const showMoreButton = screen.getByText('Show more')
    await user.click(showMoreButton)

    expect(screen.getByText('Show less')).toBeInTheDocument()
    expect(screen.getByText(/contains enough text to test the truncation/)).toBeInTheDocument()
  })

  it('should collapse content when "Show less" is clicked', async () => {
    const user = userEvent.setup()
    render(<MemoryCard memory={mockMemory} onDelete={mockOnDelete} />)

    // First expand
    await user.click(screen.getByText('Show more'))
    expect(screen.getByText('Show less')).toBeInTheDocument()

    // Then collapse
    await user.click(screen.getByText('Show less'))
    expect(screen.getByText('Show more')).toBeInTheDocument()
  })

  it('should not show expand/collapse buttons for short content', () => {
    render(<MemoryCard memory={mockShortMemory} onDelete={mockOnDelete} />)

    expect(screen.queryByText('Show more')).not.toBeInTheDocument()
    expect(screen.queryByText('Show less')).not.toBeInTheDocument()
  })

  it('should show delete button', () => {
    render(<MemoryCard memory={mockMemory} onDelete={mockOnDelete} />)

    const deleteButton = screen.getByTitle('Delete memory')
    expect(deleteButton).toBeInTheDocument()
  })

  it('should call onDelete when delete button is clicked and confirmed', async () => {
    const user = userEvent.setup()
    render(<MemoryCard memory={mockMemory} onDelete={mockOnDelete} />)

    const deleteButton = screen.getByTitle('Delete memory')
    await user.click(deleteButton)

    expect(global.confirm).toHaveBeenCalledWith('Are you sure you want to delete this memory?')
    expect(mockOnDelete).toHaveBeenCalled()
  })

  it('should not call onDelete when delete is cancelled', async () => {
    global.confirm = jest.fn(() => false)
    const user = userEvent.setup()
    render(<MemoryCard memory={mockMemory} onDelete={mockOnDelete} />)

    const deleteButton = screen.getByTitle('Delete memory')
    await user.click(deleteButton)

    expect(global.confirm).toHaveBeenCalled()
    expect(mockOnDelete).not.toHaveBeenCalled()
  })

  it('should show loading state during deletion', async () => {
    const slowDelete = jest.fn(() => new Promise(resolve => setTimeout(resolve, 100)))
    const user = userEvent.setup()
    
    render(<MemoryCard memory={mockMemory} onDelete={slowDelete} />)

    const deleteButton = screen.getByTitle('Delete memory')
    await user.click(deleteButton)

    // Should show loading spinner during deletion
    expect(screen.getByRole('button', { name: /delete memory/i })).toBeDisabled()
  })

  it('should apply consistent color to same namespace', () => {
    const memory1 = { ...mockMemory, namespace: 'projects' }
    const memory2 = { ...mockMemory, id: 'different-id', namespace: 'projects' }
    
    const { rerender } = render(<MemoryCard memory={memory1} onDelete={mockOnDelete} />)
    const firstNamespaceElement = screen.getByText('projects')
    const firstClasses = firstNamespaceElement.className

    rerender(<MemoryCard memory={memory2} onDelete={mockOnDelete} />)
    const secondNamespaceElement = screen.getByText('projects')
    const secondClasses = secondNamespaceElement.className

    // Same namespace should have same styling
    expect(firstClasses).toBe(secondClasses)
  })

  it('should handle empty labels array gracefully', () => {
    const memoryWithEmptyLabels = { ...mockMemory, labels: [] }
    render(<MemoryCard memory={memoryWithEmptyLabels} onDelete={mockOnDelete} />)

    expect(screen.getByText('test-namespace')).toBeInTheDocument()
    expect(screen.getByText(/This is a test memory content/)).toBeInTheDocument()
  })

  it('should be accessible', () => {
    render(<MemoryCard memory={mockMemory} onDelete={mockOnDelete} />)

    // Delete button should be accessible
    const deleteButton = screen.getByRole('button', { name: /delete memory/i })
    expect(deleteButton).toBeInTheDocument()

    // Content should be readable
    expect(screen.getByText(/This is a test memory content/)).toBeInTheDocument()
  })
})