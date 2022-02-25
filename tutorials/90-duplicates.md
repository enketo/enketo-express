Prior to version 1.29.2, Enketo Express contained a bug that allowed a duplicate Enketo ID to be issued to a different form. (All the affected formIDs contain a _"U"_ character.) The bug resulted in 2 possible errors:

1. When loading a webform, a completely different form is loaded instead. That form may not even belong to the same account.
2. When loading a webform, the error _"Form with ID 'MyID' is not found in /formList"_ is shown.

Note that error #2 could also have other causes outside of Enketo.

### Fix the bug

It is recommended to **immediately upgrade** to version 1.29.2 to avoid creating more duplicate entries. The longer you wait the more duplicates are created and the more users will be affected.

### Remove duplicates from the database

If you have user reports of forms that were affected by this bug, it is not easy to recover functionality for these forms without re-uploading the form to KoBo/Ona/Aggregate with a new FormID.

For this reason, we developed a tool that could be used to remove duplicates from Enketo's database. After this is done, the next time the user **clicks the Enketo/Webform button** (i.e. a new API call is made), a new non-duplicate webform URL will be created or the old webform URL will be automatically 'healed'.

If no user reported problems on your server, you could decide to skip these steps. Nevertheless, it would probably be interesting to run at least step #3.

To use the tool:

1. Create a backup of `/var/lib/redis/enketo-main.rdb` (and know how to restore from a backup!).
2. Go to the enketo-express folder.
3. To check for duplicates, run `node tools/duplicates`.
4. To remove duplicates, run `node tools/duplicates remove`. You may have to repeat this step 2 or 3 times, until no more duplicates are found.

The /logs folder will contain a log file called _"duplicates-removed-DATETIME.txt"_ for each time, the tool successfully removed duplicates.
