### How to update

-   update git repository with `git pull` (Check out a specific release (git tag) for a production server)
-   update dependencies with `npm install --production` (This will run the CSS/JS builds automatically as well. If not, use `grunt` manually afterwards). You'll usually have to remove `package-lock.json`.
-   restart app
