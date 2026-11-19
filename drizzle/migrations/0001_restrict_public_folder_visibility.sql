DROP POLICY IF EXISTS "folders: public read" ON public.folders;
CREATE POLICY "folders: published materials public, admin all"
ON public.folders
FOR SELECT
TO anon, authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (
    SELECT 1
    FROM public.study_materials AS material
    WHERE material.folder_id = folders.id
      AND material.publication_status = 'published'
  )
);