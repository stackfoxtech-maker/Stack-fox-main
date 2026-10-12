import { Bento } from '@components/home/Bento';
import { SectionHead } from '@components/home/SectionHead';

/** After you sign: the client workspace, on a dark band. */
export function WorkspaceSection() {
  return (
    <section className="section-padding relative overflow-hidden bg-warm-900">
      <div className="container-fx">
        <SectionHead
          tone="dark"
          title={'Clarity doesn’t\nstop at the quote.'}
          sub="A shared workspace keeps you connected to the work, from kickoff to launch."
        />
        <Bento />
      </div>
    </section>
  );
}
