# Page snapshot

```yaml
- generic [ref=e2]:
  - generic [ref=e3]:
    - img "Ranger Logo" [ref=e6]
    - button "Switch to light theme" [ref=e8] [cursor=pointer]:
      - img [ref=e9]
    - generic [ref=e12]:
      - heading "Welcome back" [level=1] [ref=e13]
      - form "Login form" [ref=e14]:
        - generic [ref=e16]:
          - textbox "Email" [ref=e17]:
            - /placeholder: " "
          - generic [ref=e18]: Email address
        - generic [ref=e20]:
          - textbox "Password" [ref=e21]:
            - /placeholder: " "
          - generic [ref=e22]: Password
        - button "Continue" [ref=e24] [cursor=pointer]
      - paragraph [ref=e25]:
        - text: Don't have an account?
        - link "Sign up" [ref=e26] [cursor=pointer]:
          - /url: /register
    - contentinfo
  - region "Notifications (F8)":
    - list
```