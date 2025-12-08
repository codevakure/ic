// Hide copy page button - Based on GitHub issue shuding/nextra#4773
function hideCopyPageButton() {
  // Method 1: Hide the entire copy button container
  const copyContainers = document.querySelectorAll('article > div[class*="border"][class*="inline-flex"]');
  copyContainers.forEach(container => {
    // Check if it contains a button with "Copy page" text
    const copyButton = container.querySelector('button');
    if (copyButton && copyButton.textContent && copyButton.textContent.includes('Copy page')) {
      container.style.display = 'none';
    }
  });

  // Method 2: Hide all buttons containing "Copy page" text
  const buttons = document.querySelectorAll('button');
  buttons.forEach(button => {
    if (button.textContent && button.textContent.includes('Copy page')) {
      // Hide the entire parent container
      const parent = button.closest('div[class*="border"]');
      if (parent) {
        parent.style.display = 'none';
      }
      button.style.display = 'none';
    }
  });

  // Method 3: Hide dropdown options
  const options = document.querySelectorAll('[role="option"], [role="menuitem"]');
  options.forEach(option => {
    if (option.textContent && option.textContent.includes('Copy page')) {
      option.style.display = 'none';
    }
  });
}

// Run when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', hideCopyPageButton);
} else {
  hideCopyPageButton();
}

// Run after navigation changes (for SPA)
if (typeof window !== 'undefined') {
  // Use MutationObserver to detect when new elements are added
  const observer = new MutationObserver((mutations) => {
    let shouldCheck = false;
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        shouldCheck = true;
      }
    });
    if (shouldCheck) {
      setTimeout(hideCopyPageButton, 10);
    }
  });
  
  observer.observe(document.body, { 
    childList: true, 
    subtree: true 
  });
}