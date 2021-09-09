import * as path from 'path';
import { commands, Disposable, ExtensionContext, window, workspace } from 'vscode';

import { LanguageClient, LanguageClientOptions, ServerOptions, State, TransportKind } from 'vscode-languageclient/node';
import SqlPreviewContentProvider from './SqlPreviewContentProvider';

let client: LanguageClient;

export function activate(context: ExtensionContext) {
  console.log('Congratulations, your extension "dbt-language-server" is now active!');
  // The server is implemented in node
  let serverModule = context.asAbsolutePath(path.join('server', 'out', 'server.js'));
  // The debug options for the server
  // --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
  let debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

  // If the extension is launched in debug mode then the debug server options are used
  // Otherwise the run options are used
  let serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: debugOptions,
    },
  };

  let clientOptions: LanguageClientOptions = {
    // Register the server for sql documents
    documentSelector: [{ scheme: 'file', language: 'sql' }],
  };

  // Create the language client and start the client.
  client = new LanguageClient('dbtFivetranExtension', 'Dbt Language Client', serverOptions, clientOptions);

  registerSqlPreviewContentProvider(context);

  client.onDidChangeState(e => {
    if (e.newState === State.Running) {
      client.onNotification('custom/updateQueryPreview', ([uri, text]) => {
        SqlPreviewContentProvider.update(uri, text);
      });
    }
  });

  window.onDidChangeActiveTextEditor(e => {
    if (!e || e.document.uri.toString() === SqlPreviewContentProvider.uri.toString()) {
      return;
    }
    SqlPreviewContentProvider.changeActiveDocument(e.document.uri.toString());
  });

  // Start the client. This will also launch the server
  client.start();
}

function registerSqlPreviewContentProvider(context: ExtensionContext) {
  const provider = new SqlPreviewContentProvider();

  const providerRegistrations = Disposable.from(workspace.registerTextDocumentContentProvider(SqlPreviewContentProvider.scheme, provider));

  const commandRegistration = commands.registerTextEditorCommand('editor.showQueryPreview', editor => {
    SqlPreviewContentProvider.changeActiveDocument(editor.document.uri.toString());

    return workspace.openTextDocument(SqlPreviewContentProvider.uri).then(doc => {
      window.showTextDocument(doc, editor.viewColumn! + 1, true);
    });
  });

  context.subscriptions.push(provider, commandRegistration, providerRegistrations);
}

// This method is called when extension is deactivated
export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
