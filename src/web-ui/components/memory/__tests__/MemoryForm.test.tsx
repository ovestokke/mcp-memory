import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryForm } from '../MemoryForm'

describe('MemoryForm', () => {
  const mockOnSubmit = jest.fn()
  const defaultProps = {
    onSubmit: mockOnSubmit,
    namespaces: ['general', 'work', 'personal'],
  }

  beforeEach(() => {
    mockOnSubmit.mockClear()
  })

  it('should render form fields correctly', () => {
    render(<MemoryForm {...defaultProps} />)

    expect(screen.getByLabelText(/memory content/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/namespace/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/labels/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add memory/i })).toBeInTheDocument()
  })

  it('should show character count for memory content', async () => {
    const user = userEvent.setup()
    render(<MemoryForm {...defaultProps} />)

    const contentInput = screen.getByLabelText(/memory content/i)

    await user.type(contentInput, 'Hello world')

    expect(screen.getByText('11/8000 characters')).toBeInTheDocument()
  })

  it('should disable submit button when content is empty', () => {
    render(<MemoryForm {...defaultProps} />)

    const submitButton = screen.getByRole('button', { name: /add memory/i })
    expect(submitButton).toBeDisabled()
  })

  it('should enable submit button when content is provided', async () => {
    const user = userEvent.setup()
    render(<MemoryForm {...defaultProps} />)

    const contentInput = screen.getByLabelText(/memory content/i)
    const submitButton = screen.getByRole('button', { name: /add memory/i })

    await user.type(contentInput, 'Valid memory content')

    expect(submitButton).toBeEnabled()
  })

  it('should validate content and show error messages', async () => {
    const user = userEvent.setup()
    render(<MemoryForm {...defaultProps} />)

    const contentInput = screen.getByLabelText(/memory content/i)
    const submitButton = screen.getByRole('button', { name: /add memory/i })

    // Type short content
    await user.type(contentInput, 'Hi')
    await user.click(submitButton)

    expect(screen.getByText('Memory content must be at least 3 characters')).toBeInTheDocument()
    expect(mockOnSubmit).not.toHaveBeenCalled()
  })

  it('should validate namespace and show error messages', async () => {
    const user = userEvent.setup()
    // Include an invalid namespace option to trigger validation
    render(<MemoryForm {...defaultProps} namespaces={[...defaultProps.namespaces, 'invalid@namespace']} />)

    const contentInput = screen.getByLabelText(/memory content/i)
    const namespaceSelect = screen.getByLabelText(/namespace/i)
    const submitButton = screen.getByRole('button', { name: /add memory/i })

    await user.type(contentInput, 'Valid content')
    await user.selectOptions(namespaceSelect, 'invalid@namespace')
    await user.click(submitButton)

    expect(screen.getByText(/namespace can only contain/i)).toBeInTheDocument()
    expect(mockOnSubmit).not.toHaveBeenCalled()
  })

  it('should validate labels and show error messages', async () => {
    const user = userEvent.setup()
    render(<MemoryForm {...defaultProps} />)

    const contentInput = screen.getByLabelText(/memory content/i)
    const labelsInput = screen.getByLabelText(/labels/i)
    const submitButton = screen.getByRole('button', { name: /add memory/i })

    await user.type(contentInput, 'Valid content')
    await user.type(labelsInput, 'valid, invalid@label')
    await user.click(submitButton)

    expect(screen.getByText(/labels can only contain/i)).toBeInTheDocument()
    expect(mockOnSubmit).not.toHaveBeenCalled()
  })

  it('should submit form with valid data', async () => {
    const user = userEvent.setup()
    mockOnSubmit.mockResolvedValueOnce(true)

    render(<MemoryForm {...defaultProps} />)

    const contentInput = screen.getByLabelText(/memory content/i)
    const namespaceSelect = screen.getByLabelText(/namespace/i)
    const labelsInput = screen.getByLabelText(/labels/i)
    const submitButton = screen.getByRole('button', { name: /add memory/i })

    await user.type(contentInput, 'This is a valid memory content')
    await user.selectOptions(namespaceSelect, 'work')
    await user.type(labelsInput, 'important, work, test')
    await user.click(submitButton)

    expect(mockOnSubmit).toHaveBeenCalledWith({
      content: 'This is a valid memory content',
      namespace: 'work',
      labels: ['important', 'work', 'test'],
    })
  })

  it('should reset form after successful submission', async () => {
    const user = userEvent.setup()
    mockOnSubmit.mockResolvedValueOnce(true)

    render(<MemoryForm {...defaultProps} />)

    const contentInput = screen.getByLabelText(/memory content/i)
    const labelsInput = screen.getByLabelText(/labels/i)
    const submitButton = screen.getByRole('button', { name: /add memory/i })

    await user.type(contentInput, 'Test content')
    await user.type(labelsInput, 'test')
    await user.click(submitButton)

    await waitFor(() => {
      expect(contentInput).toHaveValue('')
      expect(labelsInput).toHaveValue('')
    })
  })

  it('should not reset form after failed submission', async () => {
    const user = userEvent.setup()
    mockOnSubmit.mockResolvedValueOnce(false)

    render(<MemoryForm {...defaultProps} />)

    const contentInput = screen.getByLabelText(/memory content/i)
    const submitButton = screen.getByRole('button', { name: /add memory/i })

    await user.type(contentInput, 'Test content')
    await user.click(submitButton)

    await waitFor(() => {
      expect(contentInput).toHaveValue('Test content')
    })
  })

  it('should show loading state during submission', async () => {
    const user = userEvent.setup()
    // Create a promise that we can resolve manually
    let resolveSubmit: (value: boolean) => void
    const submitPromise = new Promise<boolean>((resolve) => {
      resolveSubmit = resolve
    })
    mockOnSubmit.mockReturnValueOnce(submitPromise)

    render(<MemoryForm {...defaultProps} />)

    const contentInput = screen.getByLabelText(/memory content/i)
    const submitButton = screen.getByRole('button', { name: /add memory/i })

    await user.type(contentInput, 'Test content')
    await user.click(submitButton)

    expect(screen.getByText('Adding...')).toBeInTheDocument()
    expect(submitButton).toBeDisabled()

    // Resolve the submission
    resolveSubmit!(true)

    await waitFor(() => {
      expect(screen.getByText('Add Memory')).toBeInTheDocument()
      expect(submitButton).toBeDisabled() // Should be disabled again because form is reset
    })
  })

  it('should include default namespaces in dropdown', () => {
    render(<MemoryForm {...defaultProps} />)

    // Check that default namespaces are present
    expect(screen.getByRole('option', { name: /general/i })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /people/i })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /projects/i })).toBeInTheDocument()
  })

  it('should merge provided namespaces with default ones', () => {
    render(<MemoryForm {...defaultProps} />)

    // Should include both default and provided namespaces
    expect(screen.getByRole('option', { name: /general/i })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /work/i })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /personal/i })).toBeInTheDocument()
  })

  it('should sanitize input data before submission', async () => {
    const user = userEvent.setup()
    mockOnSubmit.mockResolvedValueOnce(true)

    render(<MemoryForm {...defaultProps} />)

    const contentInput = screen.getByLabelText(/memory content/i)
    const labelsInput = screen.getByLabelText(/labels/i)
    const submitButton = screen.getByRole('button', { name: /add memory/i })

    // Type content with extra spaces and HTML-like content
    await user.type(contentInput, '  Content with   extra spaces <script>  ')
    await user.type(labelsInput, '  label1  ,  label2  ,  ')
    await user.click(submitButton)

    expect(mockOnSubmit).toHaveBeenCalledWith({
      content: 'Content with extra spaces ',
      namespace: 'general',
      labels: ['label1', 'label2'],
    })
  })
})
