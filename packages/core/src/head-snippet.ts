// SPDX-License-Identifier: MIT
import {
  type ConsentModeHeadWindow,
  installConsentModeDefaults,
} from "./head-bootstrap";

installConsentModeDefaults(window as Window & ConsentModeHeadWindow);
