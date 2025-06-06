/* SPDX-License-Identifier: Apache-2.0 */

const populateWebAuthnErrorList = (errors) => {
  const errorList = document.getElementById("webauthn-errors");
  if (errorList === null) {
    return;
  }

  /* NOTE: We only set the alert role once we actually have errors to present,
   * to avoid hijacking screenreaders unnecessarily.
   */
  errorList.setAttribute("role", "alert");

  errors.forEach((error) => {
    const errorItem = document.createElement("li");
    errorItem.appendChild(document.createTextNode(error));
    errorList.appendChild(errorItem);
  });
};

const doWebAuthn = (formId, func) => {
  if (!window.PublicKeyCredential) {
    return;
  }

  const webAuthnForm = document.getElementById(formId);
  if (webAuthnForm === null) {
    return null;
  }

  const webAuthnButton = webAuthnForm.querySelector("button[type=submit]");
  webAuthnButton.disabled = false;

  webAuthnForm.addEventListener("submit", async() => {
    func(webAuthnButton.value);
    event.preventDefault();
  });
};

const webAuthnBtoA = (encoded) => {
  return btoa(encoded).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
};

const webAuthnBase64Normalize = (encoded) => {
  return encoded.replace(/_/g, "/").replace(/-/g, "+");
};

const transformAssertionOptions = (assertionOptions) => {
  let {challenge, allowCredentials} = assertionOptions;

  challenge = Uint8Array.from(challenge, c => c.charCodeAt(0));
  allowCredentials = allowCredentials.map(credentialDescriptor => {
    let {id} = credentialDescriptor;
    id = webAuthnBase64Normalize(id);
    id = Uint8Array.from(atob(id), c => c.charCodeAt(0));
    return Object.assign({}, credentialDescriptor, {id});
  });

  const transformedOptions = Object.assign(
    {},
    assertionOptions,
    {challenge, allowCredentials});

  return transformedOptions;
};

const transformAssertion = (assertion) => {
  const authData = new Uint8Array(assertion.response.authenticatorData);
  const clientDataJSON = new Uint8Array(assertion.response.clientDataJSON);
  const rawId = new Uint8Array(assertion.rawId);
  const sig = new Uint8Array(assertion.response.signature);
  const assertionClientExtensions = assertion.getClientExtensionResults();

  return {
    id: assertion.id,
    rawId: webAuthnBtoA(String.fromCharCode(...rawId)),
    response: {
      authenticatorData: webAuthnBtoA(String.fromCharCode(...authData)),
      clientDataJSON: webAuthnBtoA(String.fromCharCode(...clientDataJSON)),
      signature: webAuthnBtoA(String.fromCharCode(...sig)),
    },
    type: assertion.type,
    assertionClientExtensions: JSON.stringify(assertionClientExtensions),
  };
};

const transformCredentialOptions = (credentialOptions) => {
  let {challenge, user} = credentialOptions;
  user.id = Uint8Array.from(credentialOptions.user.id, c => c.charCodeAt(0));
  challenge = Uint8Array.from(credentialOptions.challenge, c => c.charCodeAt(0));

  const transformedOptions = Object.assign({}, credentialOptions, {challenge, user});

  return transformedOptions;
};

const transformCredential = (credential) => {
  const attObj = new Uint8Array(credential.response.attestationObject);
  const clientDataJSON = new Uint8Array(credential.response.clientDataJSON);
  const rawId = new Uint8Array(credential.rawId);
  const registrationClientExtensions = credential.getClientExtensionResults();

  return {
    id: credential.id,
    rawId: webAuthnBtoA(String.fromCharCode(...rawId)),
    type: credential.type,
    response: {
      attestationObject: webAuthnBtoA(String.fromCharCode(...attObj)),
      clientDataJSON: webAuthnBtoA(String.fromCharCode(...clientDataJSON)),
    },
    registrationClientExtensions: JSON.stringify(registrationClientExtensions),
  };
};

const postCredential = async (label, credential, token) => {
  const formData = new FormData();
  formData.set("label", label);
  formData.set("credential", JSON.stringify(credential));
  formData.set("csrf_token", token);

  const resp = await fetch(
    "/manage/account/webauthn-provision/validate", {
      method: "POST",
      cache: "no-cache",
      body: formData,
      credentials: "same-origin",
    },
  );

  return await resp.json();
};

const postAssertion = async (assertion, token, rememberDevice) => {
  const formData = new FormData();
  formData.set("credential", JSON.stringify(assertion));
  formData.set("csrf_token", token);
  if (rememberDevice) {
    formData.set("remember_device", "true");
  }

  const resp = await fetch(
    "/account/webauthn-authenticate/validate" + window.location.search, {
      method: "POST",
      cache: "no-cache",
      body: formData,
      credentials: "same-origin",
    },
  );

  return await resp.json();
};

export const GuardWebAuthn = () => {
  if (!window.PublicKeyCredential) {
    let webauthn_button = document.getElementById("webauthn-button");
    if (webauthn_button) {
      webauthn_button.className += " button--disabled";
    }

    let webauthn_error = document.getElementById("webauthn-browser-support");
    if (webauthn_error) {
      webauthn_error.style.display = "block";
    }

    let webauthn_label = document.getElementById("webauthn-provision-label");
    if (webauthn_label) {
      webauthn_label.disabled = true;
    }
  }
};

export const ProvisionWebAuthn = () => {
  doWebAuthn("webauthn-provision-form", async (csrfToken) => {
    const label = document.getElementById("webauthn-provision-label").value;

    const resp = await fetch(
      "/manage/account/webauthn-provision/options", {
        cache: "no-cache",
        credentials: "same-origin",
      },
    );

    const credentialOptions = await resp.json();
    const transformedOptions = transformCredentialOptions(credentialOptions);
    await navigator.credentials.create({
      publicKey: transformedOptions,
    }).then(async (credential) => {
      const transformedCredential = transformCredential(credential);

      const status = await postCredential(label, transformedCredential, csrfToken);
      if (status.fail) {
        populateWebAuthnErrorList(status.fail.errors);
        return;
      }

      window.location.replace("/manage/account");
    }).catch((error) => {
      populateWebAuthnErrorList([error.message]);
      return;
    });
  });
};

export const AuthenticateWebAuthn = () => {
  doWebAuthn("webauthn-auth-form", async (csrfToken) => {
    const resp = await fetch(
      "/account/webauthn-authenticate/options" + window.location.search, {
        cache: "no-cache",
        credentials: "same-origin",
      },
    );

    const assertionOptions = await resp.json();
    if (assertionOptions.fail) {
      window.location.replace("/account/login");
      return;
    }

    const rememberDevice = document.getElementById("remember_device_webauthn").checked;
    const transformedOptions = transformAssertionOptions(assertionOptions);
    await navigator.credentials.get({
      publicKey: transformedOptions,
    }).then(async (assertion) => {
      const transformedAssertion = transformAssertion(assertion);

      const status = await postAssertion(transformedAssertion, csrfToken, rememberDevice);
      if (status.fail) {
        populateWebAuthnErrorList(status.fail.errors);
        return;
      }

      window.location.replace(status.redirect_to);
    }).catch((error) => {
      populateWebAuthnErrorList([error.message]);
      return;
    });
  });
};
