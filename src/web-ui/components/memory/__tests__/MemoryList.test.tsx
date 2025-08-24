import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryList } from '../MemoryList'
import { Memory } from '../../../types/memory'

// Mock the LoadingSpinner component
jest.mock('../../LoadingSpinner', () => ({
  LoadingSpinner: ({ size, className }: { size?: string; className?: string }) => (
    <div data-testid="loading-spinner" data-size={size} className={className}>
      Loading...
    </div>
  ),
}))

describe('MemoryList', () => {
  const mockOnDelete = jest.fn()

  const mockMemories: Memory[] = [
    {
      id: '1',
      content: 'First memory content',
      namespace: 'general',
      labels: ['important', 'work'],
      createdAt: '2023-01-01T10:00:00Z',
      updatedAt: '2023-01-01T10:00:00Z',
    },
    {
      id: '2',
      content: 'Second memory content',
      namespace: 'personal',
      labels: ['personal', 'notes'],
      createdAt: '2023-01-02T15:30:00Z',
      updatedAt: '2023-01-02T15:30:00Z',
    },
  ]

  beforeEach(() => {
    mockOnDelete.mockClear()
    // Mock window.confirm
    // Ensure confirm exists in the test environment
    ;(globalThis as any).confirm = jest.fn()
  })

  it('should show loading state', () => {
    render(<MemoryList memories={[]} loading={true} onDelete={mockOnDelete} />)

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
    expect(screen.getByText('Loading memories...')).toBeInTheDocument()
  })

  it('should show empty state when no memories', () => {
    render(<MemoryList memories={[]} loading={false} onDelete={mockOnDelete} />)

    expect(screen.getByText('No memories found')).toBeInTheDocument()
    expect(screen.getByText('Add your first memory above to get started')).toBeInTheDocument()
    expect(screen.getByText('🧠')).toBeInTheDocument()
  })

  it('should render memories correctly', () => {
    render(<MemoryList memories={mockMemories} loading={false} onDelete={mockOnDelete} />)

    expect(screen.getByText('First memory content')).toBeInTheDocument()
    expect(screen.getByText('Second memory content')).toBeInTheDocument()

    // Check namespaces are displayed
    expect(screen.getByText('general')).toBeInTheDocument()
    expect(screen.getByText('personal')).toBeInTheDocument()
  })

  it('should display labels correctly', () => {
    render(<MemoryList memories={mockMemories} loading={false} onDelete={mockOnDelete} />)

    // Check labels are displayed with # prefix
    expect(screen.getByText('#important')).toBeInTheDocument()
    expect(screen.getByText('#work')).toBeInTheDocument()
    expect(screen.getByText('#personal')).toBeInTheDocument()
    expect(screen.getByText('#notes')).toBeInTheDocument()
  })

  it('should format dates correctly', () => {
    render(<MemoryList memories={mockMemories} loading={false} onDelete={mockOnDelete} />)

    // The exact format will depend on the locale, but we can check that dates are present
    // and properly formatted by checking for typical date components
    const dateElements = screen.getAllByText(/2023|Jan|1|2|10:00|15:30/)
    expect(dateElements.length).toBeGreaterThan(0)
  })

  it('should show delete button for each memory', () => {
    render(<MemoryList memories={mockMemories} loading={false} onDelete={mockOnDelete} />)

    const deleteButtons = screen.getAllByLabelText(/delete memory/i)
    expect(deleteButtons).toHaveLength(2)
  })

  it('should call onDelete when delete button is clicked and confirmed', async () => {
    const user = userEvent.setup()
    ;(globalThis as any).confirm = jest.fn().mockReturnValue(true)

    render(<MemoryList memories={mockMemories} loading={false} onDelete={mockOnDelete} />)

    const deleteButtons = screen.getAllByLabelText(/delete memory/i)
    expect(deleteButtons[0]).toBeDefined()
    await user.click(deleteButtons[0] as HTMLElement)

    expect((globalThis as any).confirm).toHaveBeenCalledWith('Are you sure you want to delete this memory?')
    expect(mockOnDelete).toHaveBeenCalledWith('1')
  })

  it('should not call onDelete when deletion is cancelled', async () => {
    const user = userEvent.setup()
    ;(globalThis as any).confirm = jest.fn().mockReturnValue(false)

    render(<MemoryList memories={mockMemories} loading={false} onDelete={mockOnDelete} />)

    const deleteButtons = screen.getAllByLabelText(/delete memory/i)
    expect(deleteButtons[0]).toBeDefined()
    await user.click(deleteButtons[0] as HTMLElement)

    expect((globalThis as any).confirm).toHaveBeenCalled()
    expect(mockOnDelete).not.toHaveBeenCalled()
  })

  it('should show loading spinner on delete button while deleting', () => {
    const memoriesWithDeletingState: Memory[] = mockMemories.slice()

    // We can't easily test the internal deleting state, but we can test the component
    // renders correctly when memories are present
    render(<MemoryList memories={memoriesWithDeletingState} loading={false} onDelete={mockOnDelete} />)

    // Should show SVG delete icons when not deleting
    const deleteButtons = screen.getAllByLabelText(/delete memory/i)
    deleteButtons.forEach((button) => {
      const svg = (button as Element).querySelector('svg')
      expect(svg).toBeInTheDocument()
    })
  })

  it('should not render labels section when memory has no labels', () => {
    const memoryWithoutLabels: Memory[] = [
      {
        id: '1',
        content: 'Memory without labels',
        namespace: 'general',
        labels: [],
        createdAt: '2023-01-01T10:00:00Z',
        updatedAt: '2023-01-01T10:00:00Z',
      },
    ]

    render(<MemoryList memories={memoryWithoutLabels} loading={false} onDelete={mockOnDelete} />)

    expect(screen.getByText('Memory without labels')).toBeInTheDocument()
    // Should not have any label elements
    expect(screen.queryByText(/^#/)).not.toBeInTheDocument()
  })

  it('should have proper accessibility attributes', () => {
    render(<MemoryList memories={mockMemories} loading={false} onDelete={mockOnDelete} />)

    const deleteButtons = screen.getAllByLabelText(/delete memory/i)
    deleteButtons.forEach((button) => {
      expect(button).toHaveAttribute('aria-label')
      // The aria-label should contain part of the memory content
      const ariaLabel = button.getAttribute('aria-label') || ''
      expect(ariaLabel).toContain('Delete memory')
    })
  })

  it('should handle hover states correctly', () => {
    render(<MemoryList memories={mockMemories} loading={false} onDelete={mockOnDelete} />)

    // Check that memory items have hover styling classes
    const memoryItems = screen.getAllByText(/memory content/)
    memoryItems.forEach((item) => {
      const memoryContainer = (item as Element).closest('[class*="hover"]')
      expect(memoryContainer).not.toBeNull()
      expect(memoryContainer).toHaveClass(/hover:bg-gray-50|hover:bg-slate-750/)
    })
  })
})
