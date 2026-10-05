# Lead workspace

The lead toolbar exposes Search, Employee, This Month, Last Month, Custom and All Time. More filters contains stage, payment state, destination and temperature. Dates filter lead creation in Asia/Kolkata.

Active chips remove individual filters. Clear filters clears the entire selection.

Click a card to open the quick edit panel. Previous/Next moves through matching leads. Open Full View opens the existing complete lead page. Its Back control returns to the saved filtered workspace. Escape closes the panel; keyboard focus is contained within the panel and returns to its opener. The drawer embeds LeadDetails itself, so profile edits use its existing Edit Lead / Save Changes flow and its full workflow, costing, payments, documents and interaction features. Closing or switching leads warns before discarding unsaved profile changes.

Filters, search, overview sort/group and view mode are URL parameters. The last workspace and independent column/overview/mobile page scroll positions are retained per signed-in user in sessionStorage. This avoids competing state-to-URL and URL-to-state effects.

Save view stores a named filter snapshot per user in localStorage. It is available in this browser/device, not shared across devices. Save with an existing name replaces that view. Saved views can be removed from the Save view dialog.

Verified on the live CRM: Sonali + October filters; quick panel; Next; full page Back; browser Back; exact column scroll restoration; saved view creation/restore; search in Overview; reload persistence; mobile layout and mobile quick panel. No customer records were changed during these checks.
