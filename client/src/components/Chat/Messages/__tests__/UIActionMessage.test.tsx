import React from 'react';
import { render, screen } from '@testing-library/react';
import { RecoilRoot } from 'recoil';
import '@testing-library/jest-dom/extend-expect';
import UIActionMessage from '../UIActionMessage';

// Mock the MultiMessage component to avoid circular dependencies
jest.mock('../MultiMessage', () => ({
  __esModule: true,
  default: ({ messagesTree }) => (
    <div data-testid="multi-message">{messagesTree?.length ?? 0} children</div>
  ),
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  MousePointerClick: () => <span data-testid="mouse-pointer-click">MousePointerClick</span>,
}));

// Mock utils
jest.mock('~/utils', () => ({
  cn: (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(' '),
}));

describe('UIActionMessage', () => {
  const createMessage = (metadata = {}) => ({
    messageId: 'test-message-id',
    conversationId: 'test-conversation-id',
    parentMessageId: 'parent-message-id',
    sender: 'User',
    text: 'Test UI action message text',
    isCreatedByUser: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metadata,
    children: [],
  });

  const renderComponent = (message) => {
    return render(
      <RecoilRoot>
        <UIActionMessage 
          message={message}
          conversation={null}
          currentEditId={null}
          setCurrentEditId={() => {}}
        />
      </RecoilRoot>
    );
  };

  describe('when metadata.isUIAction is false or undefined', () => {
    it('should return null when isUIAction is false', () => {
      const message = createMessage({ isUIAction: false });
      const { container } = renderComponent(message);
      expect(container.firstChild).toBeNull();
    });

    it('should return null when isUIAction is undefined', () => {
      const message = createMessage({});
      const { container } = renderComponent(message);
      expect(container.firstChild).toBeNull();
    });

    it('should return null when metadata is undefined', () => {
      const message = createMessage();
      message.metadata = undefined;
      const { container } = renderComponent(message);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('when metadata.isUIAction is true', () => {
    it('should render the action indicator with summary', () => {
      const message = createMessage({ 
        isUIAction: true,
        uiActionType: 'tool',
        uiActionSummary: 'Get Mail Message',
      });
      renderComponent(message);
      
      expect(screen.getByText('Get Mail Message')).toBeInTheDocument();
      expect(screen.getByTestId('mouse-pointer-click')).toBeInTheDocument();
    });

    it('should render with intent action type', () => {
      const message = createMessage({ 
        isUIAction: true,
        uiActionType: 'intent',
        uiActionSummary: 'Approve',
      });
      renderComponent(message);
      
      expect(screen.getByText('Approve')).toBeInTheDocument();
    });

    it('should render with prompt action type', () => {
      const message = createMessage({ 
        isUIAction: true,
        uiActionType: 'prompt',
        uiActionSummary: 'Help me with this task',
      });
      renderComponent(message);
      
      expect(screen.getByText('Help me with this task')).toBeInTheDocument();
    });

    it('should show default label when no summary provided', () => {
      const message = createMessage({ 
        isUIAction: true,
        uiActionType: 'tool',
      });
      renderComponent(message);
      
      // Falls back to 'Processing...' when no summary
      expect(screen.getByText('Processing...')).toBeInTheDocument();
    });

    it('should show Processing when type is unknown', () => {
      const message = createMessage({ 
        isUIAction: true,
        uiActionType: 'unknown-type',
      });
      renderComponent(message);
      
      expect(screen.getByText('Processing...')).toBeInTheDocument();
    });
  });

  describe('children rendering', () => {
    it('should render MultiMessage with children', () => {
      const childMessage = {
        messageId: 'child-message-id',
        conversationId: 'test-conversation-id',
        parentMessageId: 'test-message-id',
        sender: 'Assistant',
        text: 'Response to UI action',
        isCreatedByUser: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      const message = createMessage({ 
        isUIAction: true,
        uiActionType: 'tool',
        uiActionSummary: 'Executing action...',
      });
      message.children = [childMessage];
      
      renderComponent(message);
      
      expect(screen.getByTestId('multi-message')).toBeInTheDocument();
      expect(screen.getByText('1 children')).toBeInTheDocument();
    });

    it('should render MultiMessage with no children', () => {
      const message = createMessage({ 
        isUIAction: true,
        uiActionType: 'tool',
        uiActionSummary: 'Executing action...',
      });
      message.children = [];
      
      renderComponent(message);
      
      expect(screen.getByTestId('multi-message')).toBeInTheDocument();
      expect(screen.getByText('0 children')).toBeInTheDocument();
    });
  });

  describe('styling', () => {
    it('should render with correct container alignment (right)', () => {
      const message = createMessage({ 
        isUIAction: true,
        uiActionType: 'tool',
        uiActionSummary: 'Test action',
      });
      const { container } = renderComponent(message);
      
      // Check the container has justify-end class for right alignment
      const actionContainer = container.querySelector('.justify-end');
      expect(actionContainer).toBeInTheDocument();
    });

    it('should render the icon', () => {
      const message = createMessage({ 
        isUIAction: true,
        uiActionType: 'tool',
        uiActionSummary: 'Test action',
      });
      renderComponent(message);
      
      expect(screen.getByTestId('mouse-pointer-click')).toBeInTheDocument();
    });
  });
});
