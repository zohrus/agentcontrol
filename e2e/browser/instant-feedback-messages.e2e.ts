import { afterEach, test } from "bun:test";
import {
  expectStreamToShow,
  expectStreamToShowOnce,
} from "../support/browser/browser-expectations.ts";
import { expectPageToShow } from "../support/browser/page-expectations.ts";
import { aReadySessionBehindARelaySlowToTakeMessages } from "../support/browser/ready-session-setups.ts";
import { BROWSER_TEST_TIMEOUT_MS } from "../support/browser/start-app-in-browser.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";

afterEach(cleanUpAfterTest);

test(
  "a sent message shows as sending, then is replaced by the conversation's own copy, once",
  async () => {
    // ********************************************************************
    // ** GIVEN a ready session whose agent will reply, and a relay that is slow to take messages
    // ********************************************************************
    const { app, relay } = await aReadySessionBehindARelaySlowToTakeMessages("In place");

    // ********************************************************************
    // ** WHEN the user sends "Add rate limiting"
    // ********************************************************************
    await app.page.sendsMessage("Add rate limiting");
    // AND the conversation shows it as sending while the relay has not taken it
    await expectStreamToShow(app, "Add rate limiting");
    await expectPageToShow(app, "Sending…");
    // AND the relay takes it
    relay.answers();

    // ********************************************************************
    // ** THEN the agent's reply arrives and the message is in the conversation exactly once
    // ********************************************************************
    await expectStreamToShow(app, "In place");
    await expectStreamToShowOnce(app, "Add rate limiting");
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "a message the relay refuses stays in the conversation with the reason, and can be sent again",
  async () => {
    // ********************************************************************
    // ** GIVEN a ready session whose agent will reply, and a message the relay will refuse
    // ********************************************************************
    const { app, relay } = await aReadySessionBehindARelaySlowToTakeMessages("In place");
    await app.page.sendsMessage("Add rate limiting");
    await expectPageToShow(app, "Sending…");

    // ********************************************************************
    // ** WHEN the relay refuses it
    // ********************************************************************
    relay.refuses("The agent is busy");

    // ********************************************************************
    // ** THEN the message is still shown, marked as not sent with the reason
    // ********************************************************************
    await expectPageToShow(app, "Not sent:", "The agent is busy");
    await expectStreamToShowOnce(app, "Add rate limiting");
    // AND sending it again delivers it, without a second copy
    await app.page.sendsAgain();
    await expectStreamToShow(app, "In place");
    await expectStreamToShowOnce(app, "Add rate limiting");
  },
  BROWSER_TEST_TIMEOUT_MS,
);
