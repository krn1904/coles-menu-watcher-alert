Hosted on vercel.
ToDo
1. setup things that differentiate changes made in the list
2. store data if list has been changed on coles site. ( function should run daily 1 time.)
3. verify if functin is working and scraping or not.
4. make 2 environments after basic implemmentation is done.
5. make email list working/ chcek supabase for this as well.
6. verify which services we can use for email - do not need domain for that 

New
Deploy your function to Supabase. - done
Set up a GitHub Actions workflow to trigger the function daily. - done
Ensure your frontend lists deals from Supabase.
Make sure your function sends emails only when new deals are found.
Test the full flow: scrape → update DB → send email → frontend shows new deals.

# Coles Menu Watcher & Alert

## What is Implemented

- **Supabase Edge Function Scraper**: Scrapes Coles half-price deals and inserts/updates them in the Supabase `deals` table.
- **Daily Scheduling**: GitHub Actions workflow triggers the scraper function every day at 8am UTC.
- **Frontend Deal Listing**: React frontend fetches and displays the latest deals from Supabase.
- **Subscription Form**: Users can subscribe with their email, categories, and minimum discount (saved to `subscriptions` table). - verify this


## What is NOT Implemented Yet

- **Basic Email Notification Logic**: The backend can send emails to all subscribers when new deals are found (or always, for testing).
    - Need one email/domain to setup and test this. working around for free hosting sites which we can use or last option to purchase something to live this website.
- **Category/Discount Filtering in Emails**: Subscribers do not yet receive personalized emails based on their preferences.
- **Unsubscribe Functionality**: No way for users to unsubscribe from email alerts.
- **Production Email Sending**: Resend requires a custom domain for production. For dev/testing, use SendGrid or Mailgun as described in the docs.
- **Robust Error Handling & Monitoring**: No advanced error reporting or alerting is set up.

## Testing Notes

- The Edge Function was temporarily set to always send emails for testing (`const hasNewDeals = true;`).
- **Remember to revert this line to its original logic** after testing:
  ```ts
  // const hasNewDeals = inserted > 0;
  const hasNewDeals = true; // TEMP: Always send emails for testing
  ```

# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/5cdc70cc-91d3-4265-bfe0-26cb3df60fdc

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/5cdc70cc-91d3-4265-bfe0-26cb3df60fdc) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/5cdc70cc-91d3-4265-bfe0-26cb3df60fdc) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)
